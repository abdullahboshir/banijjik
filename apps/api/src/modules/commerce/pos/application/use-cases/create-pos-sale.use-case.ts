import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, PERMISSION_KEY } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { PAYMENT_METHOD, type Money, type PaymentMethod } from "@banijjik/contracts/payment";
import type { PosSalePaymentResponse, PosSaleResponse } from "@banijjik/contracts/pos";
import {
  INSTANT_ORDER_APPROVAL_SUBJECT,
  ORDER_SOURCE,
  type OrderResponse,
} from "@banijjik/contracts/sales";
import type { PosSaleBody } from "@banijjik/validation/pos";
import type { MemberId, OrganizationId, PosSessionId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { InstantSaleService, PreparedInstantSale } from "../../../sales/index.js";
import { openSessionOf } from "../open-session.js";
import { forbidden, priceOverrideApprovalRequired, sessionRequired } from "../../domain/errors.js";
import { planTender, type TenderPlan } from "../../domain/tender.js";
import type {
  PosApprovalVerifier,
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
  readonly approvals: PosApprovalVerifier;
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
  readonly priceOverrideToken: string | undefined;
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

function resolvePriceOverrideToken(
  body: PosSaleBody,
  prepared: PreparedInstantSale,
): string | undefined {
  const token = body.approvalTokens?.priceOverride ?? body.approvalToken;
  if (prepared.prepared.priceOverrideReductionTotal.amount > 0 && token === undefined) {
    throw priceOverrideApprovalRequired();
  }
  return token;
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
    await this.assertPriceOverridePermitted(body, device);
    const settings = await settingsReader.read(input.organizationId, device.locationId);
    const memberId = await caller.memberIdOf(input.actorUserId, input.organizationId);
    const { payments, storeCreditUse, cashTendered, approvalTokens, ...orderBody } = body;
    const discountToken = approvalTokens?.discount ?? orderBody.approvalToken;
    const session = await openSessionOf(sessions, settings, device);
    const prepared = await sales.prepare({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      allowedLocationIds: input.allowedLocationIds,
      body: {
        ...orderBody,
        ...(discountToken === undefined ? {} : { approvalToken: discountToken }),
        locationId: device.locationId,
      },
      source: ORDER_SOURCE.POS,
      posSessionId: session?.posSessionId ?? null,
    });
    const priceOverrideToken = resolvePriceOverrideToken(body, prepared);
    const plan = planTender({
      grandTotal: prepared.grandTotal,
      storeCreditUse,
      payments,
      cashTendered,
      allowCreditSale: settings.allowCreditSale,
      hasContact: prepared.contactId !== null,
    });
    return { input, memberId, settings, prepared, plan, session, priceOverrideToken };
  }

  private async assertPriceOverridePermitted(
    body: PosSaleBody,
    device: PosDeviceContext,
  ): Promise<void> {
    if (!body.lines.some((line) => line.unitPriceOverride !== undefined)) return;
    if (
      !(await this.dependencies.caller.holdsAt(
        PERMISSION_KEY.POS_PRICE_OVERRIDE,
        device.locationId,
      ))
    ) {
      throw forbidden();
    }
  }

  private async writeSale(
    context: SaleContext,
  ): Promise<{ order: OrderResponse; payments: readonly PosSalePaymentResponse[] }> {
    const { sales, sessions, approvals, audit, clock } = this.dependencies;
    const posSessionId = context.session?.posSessionId ?? null;
    // First write of the sale: it takes the register's document, so a close that raced us conflicts here.
    if (posSessionId !== null && !(await sessions.markSale(posSessionId, clock.now()))) {
      throw sessionRequired();
    }
    const reduction = context.prepared.prepared.priceOverrideReductionTotal;
    if (reduction.amount > 0) {
      if (context.priceOverrideToken === undefined) throw priceOverrideApprovalRequired();
      await approvals.consume(context.priceOverrideToken, {
        action: APPROVAL_ACTION.PRICE_OVERRIDE,
        subjectKey: INSTANT_ORDER_APPROVAL_SUBJECT,
        amount: reduction,
      });
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
