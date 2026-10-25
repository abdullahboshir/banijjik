import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, PERMISSION_KEY, SEQUENCE_KEY } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/payment";
import {
  POS_EVENT_TYPE,
  POS_RULE_KEY,
  POS_SESSION_STATUS,
  type PosSessionResponse,
  type PosZReport,
} from "@banijjik/contracts/pos";
import {
  newId,
  type MemberId,
  type OrganizationId,
  type PosSessionId,
  type UserId,
} from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { nextSequenceValue } from "../../../../../kernel/sequence/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import {
  DomainRuleError,
  forbidden,
  posRuleError,
  recordNotFound,
  sessionAlreadyOpen,
  sessionClosed,
} from "../../domain/errors.js";
import { expectedCash } from "../../domain/expected-cash.js";
import { newPosSession, type PosSession } from "../../domain/pos-session.entity.js";
import { buildZReport } from "../../domain/z-report.js";
import type {
  PosCaller,
  PosCurrencyReader,
  PosEventPublisher,
  PosPaymentPort,
  PosSessionRepository,
  PosSoldOrdersReader,
  PosUnitOfWork,
} from "../ports/pos-ports.js";

/** The device the request came from, set by `requirePosDevice` (plan decision 2). */
export interface PosDeviceContext {
  readonly posDeviceId: PosSession["posDeviceId"];
  readonly locationId: PosSession["locationId"];
}

const Z_REPORT_NUMBER_WIDTH = 6;

export function toSessionResponse(session: PosSession): PosSessionResponse {
  return {
    posSessionId: session.posSessionId,
    posDeviceId: session.posDeviceId,
    locationId: session.locationId,
    openedByMemberId: session.openedByMemberId,
    openingFloat: session.openingFloat,
    status: session.status,
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt?.toISOString() ?? null,
    closedByMemberId: session.closedByMemberId,
    expectedCash: session.expectedCash,
    countedCash: session.countedCash,
    variance: session.variance,
    zReportNumber: session.zReportNumber,
    version: session.version,
  };
}

function assertCurrency(amount: Money, expected: Money["currency"]): void {
  if (amount.currency !== expected) {
    throw posRuleError(POS_RULE_KEY.CURRENCY_MISMATCH, { currency: expected });
  }
}

export interface OpenSessionDependencies {
  readonly sessions: PosSessionRepository;
  readonly caller: PosCaller;
  readonly currency: PosCurrencyReader;
  readonly unitOfWork: PosUnitOfWork;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

/** `POST /pos/sessions`: opens the register of this device with a float; one OPEN session per device. */
export class OpenPosSessionUseCase {
  constructor(private readonly dependencies: OpenSessionDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly device: PosDeviceContext;
    readonly openingFloat: Money;
  }): Promise<PosSessionResponse> {
    const { sessions, caller, currency, unitOfWork, audit, clock } = this.dependencies;
    assertCurrency(input.openingFloat, await currency.read(input.organizationId));
    await this.assertNoneOpen(input.device);
    const session = newPosSession({
      posSessionId: newId<PosSessionId>(),
      organizationId: input.organizationId,
      posDeviceId: input.device.posDeviceId,
      locationId: input.device.locationId,
      openedByMemberId: await caller.memberIdOf(input.actorUserId, input.organizationId),
      openingFloat: input.openingFloat,
      actorUserId: input.actorUserId,
      now: clock.now(),
    });
    try {
      await unitOfWork.run(async () => {
        await sessions.insert(session);
        await audit.record({
          action: AUDIT_ACTION.POS_SESSION_OPENED,
          entityType: AUDIT_ENTITY_TYPE.posSession,
          entityId: session.posSessionId,
          changes: { openingFloat: { to: session.openingFloat.amount } },
        });
      });
    } catch (error) {
      if (!(error instanceof DomainRuleError)) throw error;
      // The unique index decided a race: name the winner, as the pre-check would have.
      await this.assertNoneOpen(input.device);
      throw error;
    }
    return toSessionResponse(session);
  }

  private async assertNoneOpen(device: PosDeviceContext): Promise<void> {
    const open = await this.dependencies.sessions.findOpenByDevice(device.posDeviceId);
    if (open !== undefined) throw sessionAlreadyOpen(open.posSessionId);
  }
}

export interface CloseSessionDependencies {
  readonly sessions: PosSessionRepository;
  readonly payments: PosPaymentPort;
  readonly soldOrders: PosSoldOrdersReader;
  readonly caller: PosCaller;
  readonly unitOfWork: PosUnitOfWork;
  readonly audit: AuditRecorder;
  readonly events: PosEventPublisher;
  readonly clock: Clock;
}

/** The cashier closes their own session; another member's needs `pos.device.manage` at its location. */
async function assertMayClose(
  caller: PosCaller,
  session: PosSession,
  memberId: MemberId,
): Promise<void> {
  if (session.openedByMemberId === memberId) return;
  if (await caller.holdsAt(PERMISSION_KEY.POS_DEVICE_MANAGE, session.locationId)) return;
  throw forbidden();
}

/** `POST /pos/sessions/{posSessionId}/close`: counts the drawer and freezes the numbered Z-report. */
export class ClosePosSessionUseCase {
  constructor(private readonly dependencies: CloseSessionDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly posSessionId: PosSessionId;
    readonly countedCash: Money;
    readonly version: number;
    readonly note: string | null;
  }): Promise<PosSessionResponse> {
    const { sessions, caller, unitOfWork, clock } = this.dependencies;
    const memberId = await caller.memberIdOf(input.actorUserId, input.organizationId);
    const closedAt = clock.now();
    const closed = await unitOfWork.run(async () => {
      // The read opens the transaction's snapshot; a sale that commits after it conflicts with the write below.
      const open = await sessions.findById(input.posSessionId);
      if (open === undefined) throw recordNotFound();
      if (open.status !== POS_SESSION_STATUS.OPEN) throw sessionClosed();
      await assertMayClose(caller, open, memberId);
      assertCurrency(input.countedCash, open.openingFloat.currency);
      return this.closeInTransaction({ ...input, open, memberId, closedAt });
    });
    return toSessionResponse(closed);
  }

  private async closeInTransaction(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly open: PosSession;
    readonly memberId: MemberId;
    readonly countedCash: Money;
    readonly version: number;
    readonly note: string | null;
    readonly closedAt: Date;
  }): Promise<PosSession> {
    const { sessions, audit, events } = this.dependencies;
    const { open, organizationId } = input;
    const totals = await this.readSessionTotals(organizationId, open.posSessionId);
    const expected = expectedCash({
      openingFloat: open.openingFloat,
      methodTotals: totals.methodTotals,
    });
    const zReportNumber = String(
      await nextSequenceValue({ organizationId, sequenceKey: SEQUENCE_KEY.ZREPORT }),
    ).padStart(Z_REPORT_NUMBER_WIDTH, "0");
    const zReport = buildZReport({
      session: open,
      zReportNumber,
      closedAt: input.closedAt,
      closedByMemberId: input.memberId,
      ...totals,
      expectedCash: expected,
      countedCash: input.countedCash,
    });
    const closed = await sessions.close(
      withCloseFields({ ...input, zReport, expected }),
      input.version,
    );
    await events.publish(
      POS_EVENT_TYPE.REGISTER_CLOSED,
      { posSessionId: closed.posSessionId },
      { orderingKey: `posSession:${closed.posSessionId}` },
    );
    await audit.record({
      action: AUDIT_ACTION.POS_SESSION_CLOSED,
      entityType: AUDIT_ENTITY_TYPE.posSession,
      entityId: closed.posSessionId,
      changes: {
        zReportNumber: { to: zReportNumber },
        variance: { to: zReport.variance.amount },
      },
    });
    return closed;
  }

  private async readSessionTotals(organizationId: OrganizationId, posSessionId: PosSessionId) {
    const { payments, soldOrders: soldOrdersReader } = this.dependencies;
    const methodTotals = await payments.methodTotals({ organizationId, posSessionId });
    const orderAllocations = await payments.orderAllocations({ organizationId, posSessionId });
    const soldOrders = await soldOrdersReader.readByPosSession(posSessionId);
    const collectionTotals = await payments.collectionTotals({
      organizationId,
      posSessionId,
      soldOrderIds: soldOrders.map((order) => order.orderId),
    });
    return { methodTotals, collectionTotals, orderAllocations, soldOrders };
  }
}

function withCloseFields(input: {
  readonly open: PosSession;
  readonly memberId: MemberId;
  readonly actorUserId: UserId;
  readonly countedCash: Money;
  readonly note: string | null;
  readonly closedAt: Date;
  readonly zReport: PosZReport;
  readonly expected: Money;
}): PosSession {
  return {
    ...input.open,
    status: POS_SESSION_STATUS.CLOSED,
    closedAt: input.closedAt,
    closedByMemberId: input.memberId,
    expectedCash: input.expected,
    countedCash: input.countedCash,
    variance: input.zReport.variance,
    closeNote: input.note,
    zReportNumber: input.zReport.zReportNumber,
    zReport: input.zReport,
    updatedAt: input.closedAt,
    updatedByUserId: input.actorUserId,
  };
}

export interface ReadZReportDependencies {
  readonly sessions: PosSessionRepository;
  readonly caller: PosCaller;
}

/** `GET /pos/sessions/{posSessionId}/z-report`: `pos.report.read` at the location, or the session's own cashier. */
export class GetPosZReportUseCase {
  constructor(private readonly dependencies: ReadZReportDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly posSessionId: PosSessionId;
  }): Promise<PosZReport> {
    const { sessions, caller } = this.dependencies;
    const session = await sessions.findById(input.posSessionId);
    if (session === undefined) throw recordNotFound();
    const memberId = await caller.memberIdOf(input.actorUserId, input.organizationId);
    const mayRead =
      session.openedByMemberId === memberId ||
      (await caller.holdsAt(PERMISSION_KEY.POS_REPORT_READ, session.locationId));
    if (!mayRead) throw forbidden();
    if (session.zReport === null) throw recordNotFound();
    return session.zReport;
  }
}
