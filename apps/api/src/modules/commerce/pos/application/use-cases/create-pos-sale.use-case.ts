import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { PAYMENT_METHOD, type Money, type PaymentMethod } from "@banijjik/contracts/payment";
import type { PosSalePaymentResponse, PosSaleResponse } from "@banijjik/contracts/pos";
import { ORDER_SOURCE, type OrderResponse } from "@banijjik/contracts/sales";
import type { PosSaleBody } from "@banijjik/validation/pos";
import type { MemberId, OrganizationId, PosSessionId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { InstantSaleService, PreparedInstantSale } from "../../../sales/index.js";
import { sessionRequired } from "../../domain/errors.js";
import { planTender, type TenderPlan } from "../../domain/tender.js";
import type {
  PosCaller,
  PosPaymentPort,
  PosSessionRepository,
  PosSettings,
  PosSettingsReader,
  PosUnitOfWork,
} from "../ports/pos-ports.js";
import type { PosDeviceContext } from "./session.use-cases.js";

export interface CreatePosSaleDependencies {
  readonly sales: InstantSaleService;
  readonly payments: PosPaymentPort;
  readonly sessions: PosSessionRepository;
  readonly settings: PosSettingsReader;
  readonly caller: PosCaller;
  readonly unitOfWork: PosUnitOfWork;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export interface CreatePosSaleInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly device: PosDeviceContext;
  readonly body: PosSaleBody;
}

interface SaleContext {
  readonly input: CreatePosSaleInput;
  readonly memberId: MemberId;
  readonly settings: PosSettings;
  readonly prepared: PreparedInstantSale;
  readonly plan: TenderPlan;
  readonly session: { readonly posSessionId: PosSessionId } | undefined;
}

interface TenderLine {
  readonly method: PaymentMethod;
  readonly amount: Money;
  readonly externalReference: string | null;
}

/** Store credit is spent first, then each payment in the order it was sent. */
function tenderLinesOf(plan: TenderPlan, payments: PosSaleBody["payments"]): readonly TenderLine[] {
  const credit: TenderLine[] =
    plan.storeCreditMinor > 0
      ? [
          {
            method: PAYMENT_METHOD.STORE_CREDIT,
            amount: { amount: plan.storeCreditMinor, currency: plan.currency },
            externalReference: null,
          },
        ]
      : [];
  const rest = payments.map((payment) => ({
    method: payment.method,
    amount: payment.amount,
    externalReference: payment.externalReference ?? null,
  }));
  return [...credit, ...rest];
}

/**
 * `POST /pos/sales` (plan 3.9 decision 4): the instant order, store credit, every payment and the
 * register's sale mark are written in ONE unit of work. A failure anywhere leaves no order, no stock
 * movement and no payment. A retry with the same `Idempotency-Key` replays the first answer.
 */
export class CreatePosSaleUseCase {
  constructor(private readonly dependencies: CreatePosSaleDependencies) {}

  async execute(input: CreatePosSaleInput): Promise<PosSaleResponse> {
    const context = await this.buildContext(input);
    const written = await this.dependencies.unitOfWork.run(() => this.writeSale(context));
    return {
      order: written.order,
      posSessionId: context.session?.posSessionId ?? null,
      payments: written.payments,
      storeCreditUsed: { amount: context.plan.storeCreditMinor, currency: context.plan.currency },
      changeDue: { amount: context.plan.changeMinor, currency: context.plan.currency },
      dueAmount: { amount: context.plan.dueMinor, currency: context.plan.currency },
      receiptFooter: context.settings.receiptFooter,
    };
  }

  /** Everything that needs no transaction: the caller, the settings, the quote, the tender and the open register. */
  private async buildContext(input: CreatePosSaleInput): Promise<SaleContext> {
    const { sales, settings: settingsReader, caller, sessions } = this.dependencies;
    const { body, device } = input;
    const settings = await settingsReader.read(input.organizationId, device.locationId);
    const memberId = await caller.memberIdOf(input.actorUserId, input.organizationId);
    const { payments, storeCreditUse, cashTendered, ...orderBody } = body;
    const prepared = await sales.prepare({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      allowedLocationIds: input.allowedLocationIds,
      body: { ...orderBody, locationId: device.locationId },
      source: ORDER_SOURCE.POS,
    });
    const plan = planTender({
      grandTotal: prepared.grandTotal,
      storeCreditUse,
      payments,
      cashTendered,
      allowCreditSale: settings.allowCreditSale,
      hasContact: prepared.contactId !== null,
    });
    const session = settings.requireShift
      ? await sessions.findOpenByDevice(device.posDeviceId)
      : undefined;
    if (settings.requireShift && session === undefined) throw sessionRequired();
    return { input, memberId, settings, prepared, plan, session };
  }

  private async writeSale(
    context: SaleContext,
  ): Promise<{ order: OrderResponse; payments: readonly PosSalePaymentResponse[] }> {
    const { sales, sessions, audit, clock } = this.dependencies;
    const posSessionId = context.session?.posSessionId ?? null;
    // First write of the sale: it takes the register's document, so a close that raced us conflicts here.
    if (posSessionId !== null && !(await sessions.markSale(posSessionId, clock.now()))) {
      throw sessionRequired();
    }
    const completed = await sales.commit(context.prepared);
    const payments = await this.takePayments(context, completed.orderId, posSessionId);
    await audit.record({
      action: AUDIT_ACTION.POS_SALE_CREATED,
      entityType: AUDIT_ENTITY_TYPE.order,
      entityId: completed.orderId,
      changes: { posSessionId: { to: posSessionId } },
    });
    return { order: await sales.read(completed.orderId), payments };
  }

  /** Store credit first, then each payment in the order sent; all of them allocate to the new order. */
  private async takePayments(
    context: SaleContext,
    orderId: string,
    posSessionId: PosSessionId | null,
  ): Promise<readonly PosSalePaymentResponse[]> {
    const { payments } = this.dependencies;
    const { input, plan, prepared, memberId } = context;
    const shared = {
      organizationId: input.organizationId,
      locationId: input.device.locationId,
      orderId,
      contactId: prepared.contactId,
      receivedByMemberId: memberId,
      actorUserId: input.actorUserId,
      posSessionId,
    };
    const lines = tenderLinesOf(plan, input.body.payments);
    const taken: PosSalePaymentResponse[] = [];
    for (const line of lines) {
      taken.push(await payments.receive({ ...shared, ...line }));
    }
    return taken;
  }
}
