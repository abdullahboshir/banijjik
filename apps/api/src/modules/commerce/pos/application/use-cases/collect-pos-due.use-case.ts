import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { PAYMENT_METHOD, type Money, type PaymentRequestType } from "@banijjik/contracts/payment";
import {
  POS_RULE_KEY,
  type PosCollectionResponse,
  type PosSalePaymentResponse,
} from "@banijjik/contracts/pos";
import type { MemberId, OrganizationId, PosSessionId, UserId } from "@banijjik/ids";
import type { PosCollectionBody } from "@banijjik/validation/pos";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import {
  locationForbidden,
  posRuleError,
  recordNotFound,
  sessionRequired,
} from "../../domain/errors.js";
import { openSessionOf } from "../open-session.js";
import type {
  PosCaller,
  PosCurrencyReader,
  PosPaymentPort,
  PosRequestReader,
  PosSessionRepository,
  PosSettingsReader,
  PosUnitOfWork,
} from "../ports/pos-ports.js";
import type { PosDeviceContext } from "./session.use-cases.js";

interface AllocationSlice {
  readonly requestType: PaymentRequestType;
  readonly requestId: string;
  readonly amount: Money;
}

interface PlannedPayment {
  readonly method: PosCollectionBody["payments"][number]["method"];
  readonly amount: Money;
  readonly externalReference: string | null;
  readonly allocations: readonly AllocationSlice[];
}

function assertCurrencies(currency: Money["currency"], body: PosCollectionBody): void {
  for (const allocation of body.allocations) {
    if (allocation.amount.currency !== currency) {
      throw posRuleError(POS_RULE_KEY.CURRENCY_MISMATCH, { currency });
    }
  }
  for (const payment of body.payments) {
    if (payment.amount.currency !== currency) {
      throw posRuleError(POS_RULE_KEY.CURRENCY_MISMATCH, { currency });
    }
  }
  if (body.cashTendered !== undefined && body.cashTendered.currency !== currency) {
    throw posRuleError(POS_RULE_KEY.CURRENCY_MISMATCH, { currency });
  }
}

function computeChangeMinor(body: PosCollectionBody): number {
  const allocationsMinor = body.allocations.reduce((sum, row) => sum + row.amount.amount, 0);
  const paymentsMinor = body.payments.reduce((sum, row) => sum + row.amount.amount, 0);
  if (paymentsMinor !== allocationsMinor) {
    throw posRuleError(POS_RULE_KEY.COLLECTION_MISMATCH, {
      allocationsMinor,
      paymentsMinor,
    });
  }
  if (body.cashTendered === undefined) return 0;
  const cashMinor = body.payments
    .filter((row) => row.method === PAYMENT_METHOD.CASH)
    .reduce((sum, row) => sum + row.amount.amount, 0);
  if (cashMinor === 0 || body.cashTendered.amount < cashMinor) {
    throw posRuleError(POS_RULE_KEY.CASH_TENDERED_INVALID, {
      cashMinor,
      cashTenderedMinor: body.cashTendered.amount,
    });
  }
  return body.cashTendered.amount - cashMinor;
}

/** Splits the request allocations across the payments so each payment's allocations sum to its amount. */
function sliceAllocationsAcrossPayments(
  allocations: PosCollectionBody["allocations"],
  payments: PosCollectionBody["payments"],
  currency: Money["currency"],
): readonly PlannedPayment[] {
  const queue = allocations.map((item) => ({
    requestType: item.requestType,
    requestId: item.requestId,
    remaining: item.amount.amount,
  }));
  let cursor = 0;
  return payments.map((payment) => {
    let needed = payment.amount.amount;
    const slices: AllocationSlice[] = [];
    while (needed > 0 && cursor < queue.length) {
      const current = queue[cursor];
      if (current === undefined) break;
      const take = Math.min(needed, current.remaining);
      if (take > 0) {
        slices.push({
          requestType: current.requestType,
          requestId: current.requestId,
          amount: { amount: take, currency },
        });
        current.remaining -= take;
        needed -= take;
      }
      if (current.remaining === 0) cursor += 1;
    }
    return {
      method: payment.method,
      amount: payment.amount,
      externalReference: payment.externalReference ?? null,
      allocations: slices,
    };
  });
}

export interface CollectPosDueDependencies {
  readonly payments: PosPaymentPort;
  readonly requestReaders: PosRequestReader;
  readonly sessions: PosSessionRepository;
  readonly settings: PosSettingsReader;
  readonly caller: PosCaller;
  readonly currency: PosCurrencyReader;
  readonly unitOfWork: PosUnitOfWork;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

/** `POST /pos/collections`: collects one or more dues at the till in one transaction (plan 3.9 A2-3). */
export class CollectPosDueUseCase {
  constructor(private readonly dependencies: CollectPosDueDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly device: PosDeviceContext;
    readonly body: PosCollectionBody;
  }): Promise<PosCollectionResponse> {
    const {
      sessions,
      settings: settingsReader,
      caller,
      currency: currencyReader,
    } = this.dependencies;
    const currency = await currencyReader.read(input.organizationId);
    assertCurrencies(currency, input.body);
    const changeMinor = computeChangeMinor(input.body);
    const contactId = await this.verifyRequestsAtDevice(
      input.organizationId,
      input.device,
      input.body.allocations,
    );
    const settings = await settingsReader.read(input.organizationId, input.device.locationId);
    const memberId = await caller.memberIdOf(input.actorUserId, input.organizationId);
    const session = await openSessionOf(sessions, settings, input.device);
    const posSessionId = session?.posSessionId ?? null;
    const planned = sliceAllocationsAcrossPayments(
      input.body.allocations,
      input.body.payments,
      currency,
    );
    const taken = await this.dependencies.unitOfWork.run(() =>
      this.writeCollection({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        device: input.device,
        memberId,
        contactId,
        posSessionId,
        planned,
      }),
    );
    return {
      posSessionId,
      payments: taken,
      changeDue: { amount: changeMinor, currency },
    };
  }

  private async verifyRequestsAtDevice(
    organizationId: OrganizationId,
    device: PosDeviceContext,
    allocations: PosCollectionBody["allocations"],
  ): Promise<string | null> {
    let contactId: string | null = null;
    for (const allocation of allocations) {
      const snapshot = await this.dependencies.requestReaders.read(
        organizationId,
        allocation.requestType,
        allocation.requestId,
      );
      if (snapshot === undefined) throw recordNotFound();
      if (snapshot.locationId !== null && snapshot.locationId !== device.locationId) {
        throw locationForbidden();
      }
      if (contactId === null && snapshot.contactId !== null) {
        contactId = snapshot.contactId;
      }
    }
    return contactId;
  }

  private async writeCollection(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly device: PosDeviceContext;
    readonly memberId: MemberId;
    readonly contactId: string | null;
    readonly posSessionId: PosSessionId | null;
    readonly planned: readonly PlannedPayment[];
  }): Promise<readonly PosSalePaymentResponse[]> {
    const { payments, sessions, audit, clock } = this.dependencies;
    if (
      input.posSessionId !== null &&
      !(await sessions.markSale(input.posSessionId, clock.now()))
    ) {
      throw sessionRequired();
    }
    const taken: PosSalePaymentResponse[] = [];
    for (const item of input.planned) {
      taken.push(
        await payments.collect({
          organizationId: input.organizationId,
          locationId: input.device.locationId,
          method: item.method,
          amount: item.amount,
          externalReference: item.externalReference,
          allocations: item.allocations,
          contactId: input.contactId,
          receivedByMemberId: input.memberId,
          actorUserId: input.actorUserId,
          posSessionId: input.posSessionId,
        }),
      );
    }
    const firstPayment = taken[0];
    if (firstPayment !== undefined) {
      await audit.record({
        action: AUDIT_ACTION.POS_COLLECTION_CREATED,
        entityType:
          input.posSessionId !== null ? AUDIT_ENTITY_TYPE.posSession : AUDIT_ENTITY_TYPE.payment,
        entityId: input.posSessionId ?? firstPayment.paymentId,
        changes: { paymentCount: { to: taken.length }, posSessionId: { to: input.posSessionId } },
      });
    }
    return taken;
  }
}
