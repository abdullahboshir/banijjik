import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { PAYMENT_METHOD, type PaymentMethod } from "@banijjik/contracts/payment";
import {
  SALES_RULE_KEY,
  type Money,
  type SalesExchangePaymentResponse,
  type SalesExchangePreviewResponse,
  type SalesExchangeResponse,
} from "@banijjik/contracts/sales";
import type { ContactId, OrderId, UserId } from "@banijjik/ids";
import type {
  SalesExchangePaymentBody,
  SalesExchangeRequestBody,
  SalesReturnRequestBody,
} from "@banijjik/validation/sales";
import { salesRuleError } from "../../domain/errors.js";
import type { Order } from "../../domain/order.entity.js";
import { planSalesExchange, type SalesExchangePlan } from "../../domain/sales-exchange-plan.js";
import type {
  InstantSaleInput,
  InstantSaleService,
  PreparedInstantSale,
} from "../instant-sale.service.js";
import { writeSalesReturn } from "../sales-return-create.js";
import type { SalesReturnDependencies } from "../sales-return-dependencies.js";
import {
  loadReturnableOrder,
  prepareSalesReturn,
  requireActor,
  type PreparedSalesReturn,
} from "../sales-return-prepare.js";
import { toSalesReturnPreview, toSalesReturnResponse } from "../sales-return-views.js";
import type { SalesReturnWriteInput } from "./sales-return.use-cases.js";

/** What an exchange uses: the return's dependencies and the instant sale's two steps (plan 3.5b A3). */
export interface SalesExchangeDependencies {
  readonly returns: SalesReturnDependencies;
  readonly sales: InstantSaleService;
}

export interface SalesExchangeInput {
  readonly organizationId: SalesReturnWriteInput["organizationId"];
  readonly allowedLocationIds: SalesReturnWriteInput["allowedLocationIds"];
  readonly actorUserId: UserId | null;
  readonly orderId: OrderId;
  readonly body: SalesExchangeRequestBody;
}

/** Everything an exchange reads before its unit of work opens; nothing here writes. */
interface ExchangeContext {
  readonly actorUserId: UserId;
  readonly order: Order;
  readonly contactId: ContactId;
  /** The order note of the new order, written on each payment it takes. */
  readonly note: string | null;
  readonly newOrder: PreparedInstantSale;
}

interface Tender {
  readonly method: PaymentMethod;
  readonly amount: Money;
  readonly externalReference: string | null;
}

/** An exchange is only made for a known customer: the credit and a possible due belong to one. */
function requireContactOf(order: Order): ContactId {
  if (order.contactId === null) throw salesRuleError(SALES_RULE_KEY.SALES_EXCHANGE_NEEDS_CONTACT);
  return order.contactId;
}

/** The return part with its refund forced to store credit: the credit is what pays the new order. */
function returnInputOf(input: SalesExchangeInput, actorUserId: UserId): SalesReturnWriteInput {
  const body: SalesReturnRequestBody = {
    ...input.body.return,
    refundMethod: PAYMENT_METHOD.STORE_CREDIT,
  };
  return {
    organizationId: input.organizationId,
    allowedLocationIds: input.allowedLocationIds,
    actorUserId,
    orderId: input.orderId,
    body,
  };
}

/** The new order takes the original order's location and contact; its method is INSTANT. */
function newOrderInputOf(
  input: SalesExchangeInput,
  parties: { readonly actorUserId: UserId; readonly order: Order; readonly contactId: ContactId },
): InstantSaleInput {
  return {
    organizationId: input.organizationId,
    actorUserId: parties.actorUserId,
    allowedLocationIds: input.allowedLocationIds,
    body: {
      ...input.body.order,
      locationId: parties.order.locationId,
      contactId: parties.contactId,
    },
  };
}

async function buildContext(
  dependencies: SalesExchangeDependencies,
  input: SalesExchangeInput,
): Promise<ExchangeContext> {
  const actorUserId = requireActor(input.actorUserId);
  const order = await loadReturnableOrder(
    dependencies.returns,
    input.orderId,
    input.allowedLocationIds,
  );
  const contactId = requireContactOf(order);
  const newOrder = await dependencies.sales.prepare(
    newOrderInputOf(input, { actorUserId, order, contactId }),
  );
  return { actorUserId, order, contactId, note: input.body.order.note ?? null, newOrder };
}

/** The money of the exchange: the return's store credit against the new order's total and payments. */
function planOf(
  returnPrepared: PreparedSalesReturn,
  newOrder: PreparedInstantSale,
  payments: readonly SalesExchangePaymentBody[],
): SalesExchangePlan {
  return planSalesExchange({
    returnCredit: {
      amount: returnPrepared.settlement.refundMinor,
      currency: returnPrepared.currency,
    },
    newOrderTotal: newOrder.grandTotal,
    payments: payments.map((payment) => payment.amount),
  });
}

/** Store credit is spent first, then each payment in the order sent (as the POS does). */
function tendersOf(
  plan: SalesExchangePlan,
  payments: readonly SalesExchangePaymentBody[],
): readonly Tender[] {
  const credit: Tender[] =
    plan.storeCreditUsed.amount > 0
      ? [
          {
            method: PAYMENT_METHOD.STORE_CREDIT,
            amount: plan.storeCreditUsed,
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

/** Each tender allocates to the new order through the one order receive of payment (plan 3.5b E8). */
async function takePayments(
  dependencies: SalesExchangeDependencies,
  context: ExchangeContext,
  tenders: readonly Tender[],
): Promise<readonly SalesExchangePaymentResponse[]> {
  const { returns } = dependencies;
  const { organizationId } = context.order;
  const receivedByMemberId = await returns.members.memberIdOf(context.actorUserId, organizationId);
  const taken: SalesExchangePaymentResponse[] = [];
  for (const tender of tenders) {
    taken.push(
      await returns.payments.receiveOrderPayment({
        organizationId,
        orderId: context.newOrder.orderId,
        locationId: context.order.locationId,
        actorUserId: context.actorUserId,
        receivedByMemberId,
        method: tender.method,
        amount: tender.amount,
        contactId: context.contactId,
        externalReference: tender.externalReference,
        note: context.note,
        now: returns.clock.now(),
      }),
    );
  }
  return taken;
}

/**
 * `POST …/orders/:orderId/exchange` (plan 3.5b E6): the return, the new order, the store credit and
 * every payment in ONE unit of work. The return restocks before the new sale reserves, so the same
 * variant can be swapped back. A failure anywhere leaves no return, no credit, no stock and no order.
 */
export class CreateSalesExchangeUseCase {
  constructor(private readonly dependencies: SalesExchangeDependencies) {}

  async execute(input: SalesExchangeInput): Promise<SalesExchangeResponse> {
    const context = await buildContext(this.dependencies, input);
    return this.dependencies.returns.unitOfWork.run(() => this.writeExchange(input, context));
  }

  private async writeExchange(
    input: SalesExchangeInput,
    context: ExchangeContext,
  ): Promise<SalesExchangeResponse> {
    const { returns, sales } = this.dependencies;
    const returnInput = returnInputOf(input, context.actorUserId);
    const returnPrepared = await prepareSalesReturn(returns, returnInput);
    const plan = planOf(returnPrepared, context.newOrder, input.body.payments);
    const record = await writeSalesReturn({
      deps: returns,
      input: returnInput,
      prepared: returnPrepared,
      actorUserId: context.actorUserId,
      exchangeOrderId: context.newOrder.orderId,
    });
    await sales.commit(context.newOrder);
    const payments = await takePayments(
      this.dependencies,
      context,
      tendersOf(plan, input.body.payments),
    );
    await returns.audit.record({
      action: AUDIT_ACTION.SALES_EXCHANGE_CREATED,
      entityType: AUDIT_ENTITY_TYPE.salesReturn,
      entityId: record.salesReturnId,
      changes: {
        orderId: { to: context.order.orderId },
        exchangeOrderId: { to: context.newOrder.orderId },
      },
    });
    return {
      salesReturn: toSalesReturnResponse(record),
      order: await sales.read(context.newOrder.orderId),
      payments,
      storeCreditUsed: plan.storeCreditUsed,
      storeCreditLeft: plan.storeCreditLeft,
      dueAmount: plan.dueAmount,
    };
  }
}

/** The same checks and numbers as the create, with nothing written (plan 3.5b E10). */
export class PreviewSalesExchangeUseCase {
  constructor(private readonly dependencies: SalesExchangeDependencies) {}

  async execute(input: SalesExchangeInput): Promise<SalesExchangePreviewResponse> {
    const context = await buildContext(this.dependencies, input);
    const returnPrepared = await prepareSalesReturn(
      this.dependencies.returns,
      returnInputOf(input, context.actorUserId),
    );
    const plan = planOf(returnPrepared, context.newOrder, input.body.payments);
    return {
      salesReturn: toSalesReturnPreview(returnPrepared),
      orderGrandTotal: context.newOrder.grandTotal,
      storeCreditUsed: plan.storeCreditUsed,
      storeCreditLeft: plan.storeCreditLeft,
      dueAmount: plan.dueAmount,
    };
  }
}
