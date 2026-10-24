import {
  ORDER_STATUS,
  SALES_RETURN_REFUND_METHOD,
  SALES_RULE_KEY,
  type Money,
  type SalesReturnRefundMethod,
} from "@banijjik/contracts/sales";
import { PAYMENT_METHOD, type PaymentMethod } from "@banijjik/contracts/payment";
import { ERROR_CODE } from "@banijjik/contracts";
import type { ContactId, OrderId, OrganizationId, UserId } from "@banijjik/ids";
import { DomainRuleError, recordNotFound, salesRuleError } from "../domain/errors.js";
import type { Order } from "../domain/order.entity.js";
import { businessDateOf } from "../domain/business-date.js";
import { isReturnWindowOpen } from "../domain/sales-return-window.js";
import { planSalesReturn, type SalesReturnPlan } from "../domain/sales-return-plan.js";
import { settleReturn, type ReturnSettlement } from "../domain/sales-return-settlement.js";
import {
  orderNotReturnable,
  paymentMethodNotAvailable,
  refundMethodRequired,
  returnWindowClosed,
} from "../domain/sales-return-errors.js";
import type { SalesReturnRequestBody } from "@banijjik/validation/sales";
import type { SalesDependencies } from "./sales-dependencies.js";
import type { SalesReturnDependencies } from "./sales-return-dependencies.js";
import { assertLocationAllowed } from "./sales-transition-shared.js";

/** Everything a return needs before it writes: the order, the plan, and the refund it implies. */
export interface PreparedSalesReturn {
  readonly order: Order;
  readonly hasRefundWithoutApprovalPermission: boolean;
  readonly plan: SalesReturnPlan;
  readonly settlement: ReturnSettlement;
  readonly currency: Money["currency"];
  readonly today: string;
  readonly refundMethod: SalesReturnRefundMethod | null;
  readonly refundApprovalRequired: boolean;
  readonly notReceivedApprovalRequired: boolean;
}

export interface SalesReturnCallerInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly actorUserId: UserId | null;
}

export async function loadReturnableOrder(
  dependencies: Pick<SalesDependencies, "orders">,
  orderId: OrderId,
  allowedLocationIds: readonly string[] | "ALL",
): Promise<Order> {
  const order = await dependencies.orders.findById(orderId);
  if (order === undefined) throw recordNotFound();
  assertLocationAllowed(order.locationId, allowedLocationIds);
  return order;
}

/** The window counts from completion (organization-local date); old rows without it count from the order date. */
async function assertWindowOpen(input: {
  readonly dependencies: SalesReturnDependencies;
  readonly order: Order;
  readonly organizationId: OrganizationId;
  readonly today: string;
}): Promise<void> {
  const timeZone = await input.dependencies.timeZone.read(input.organizationId);
  const settings = await input.dependencies.settings.read(input.organizationId);
  const completedDate =
    input.order.completedAt === null
      ? input.order.businessDate
      : businessDateOf(input.order.completedAt, timeZone);
  const open = isReturnWindowOpen({
    completedBusinessDate: completedDate,
    todayBusinessDate: input.today,
    windowDays: settings.returnWindowDays,
  });
  if (!open) throw returnWindowClosed();
}

async function todayAt(
  dependencies: SalesReturnDependencies,
  organizationId: OrganizationId,
): Promise<string> {
  const timeZone = await dependencies.timeZone.read(organizationId);
  return businessDateOf(dependencies.clock.now(), timeZone);
}

/** The plan of the lines and the settlement against what was paid (decisions 4 and 5). */
async function quoteReturn(
  dependencies: SalesReturnDependencies,
  input: SalesReturnCallerInput & {
    readonly orderId: OrderId;
    readonly body: SalesReturnRequestBody;
  },
  order: Order,
): Promise<{ readonly plan: SalesReturnPlan; readonly settlement: ReturnSettlement }> {
  const currency = order.totals.grandTotal.currency;
  const deliveredMinor = await dependencies.returns.sumActiveDeliveryReturned(
    input.organizationId,
    input.orderId,
  );
  const plan = planSalesReturn({
    lines: order.lines,
    totals: order.totals,
    requestLines: input.body.lines,
    returnDeliveryCharge: input.body.returnDeliveryCharge ?? false,
    reasonKey: input.body.reasonKey,
    note: input.body.note ?? null,
    deliveryReturnedBefore: { amount: deliveredMinor, currency },
  });
  const base = await dependencies.payments.readSettlementBase({
    organizationId: input.organizationId,
    orderId: input.orderId,
  });
  const settlement = settleReturn({
    totalMinor: base.totalMinor,
    netPaidMinor: base.netPaidMinor,
    valueMinor: plan.value.amount,
  });
  return { plan, settlement };
}

/**
 * Checks, quotes and computes a return without writing (plan 3.5b decisions 2 to 6). The preview
 * and the create both use this, so they show the same numbers.
 */
export async function prepareSalesReturn(
  dependencies: SalesReturnDependencies,
  input: SalesReturnCallerInput & {
    readonly orderId: OrderId;
    readonly body: SalesReturnRequestBody;
  },
): Promise<PreparedSalesReturn> {
  const order = await loadReturnableOrder(dependencies, input.orderId, input.allowedLocationIds);
  if (order.status !== ORDER_STATUS.COMPLETED) throw orderNotReturnable(order.status);
  const today = await todayAt(dependencies, input.organizationId);
  await assertWindowOpen({ dependencies, order, organizationId: input.organizationId, today });
  const { plan, settlement } = await quoteReturn(dependencies, input, order);
  const hasRefundWithoutApprovalPermission = await refundPermissionOf(
    dependencies,
    input.actorUserId,
    order.locationId,
  );
  const refundApprovalRequired =
    settlement.refundMinor > 0 &&
    (await dependencies.refundApproval.approvalRequired(
      input.organizationId,
      hasRefundWithoutApprovalPermission,
    ));
  return {
    order,
    hasRefundWithoutApprovalPermission,
    plan,
    settlement,
    currency: order.totals.grandTotal.currency,
    today,
    refundMethod: refundMethodOf(
      input.body.refundMethod ?? null,
      settlement.refundMinor,
      order.contactId,
    ),
    refundApprovalRequired,
    notReceivedApprovalRequired: plan.notReceivedValue.amount > 0,
  };
}

/** Without a signed-in actor the exemption cannot apply, so the manager token is required. */
async function refundPermissionOf(
  dependencies: SalesReturnDependencies,
  actorUserId: UserId | null,
  locationId: string,
): Promise<boolean> {
  if (actorUserId === null) return false;
  return dependencies.refundPermission.hasRefundWithoutApproval(actorUserId, locationId);
}

/** The refund method the client named; a refund due with no method, or GATEWAY, is refused (decision 5). */
function refundMethodOf(
  method: PaymentMethod | null,
  refundMinor: number,
  contactId: ContactId | null,
): SalesReturnRefundMethod | null {
  if (refundMinor === 0) return null;
  if (method === null) throw refundMethodRequired();
  if (!isAcceptedRefundMethod(method)) throw paymentMethodNotAvailable(method);
  if (method === PAYMENT_METHOD.STORE_CREDIT && contactId === null) {
    throw salesRuleError(SALES_RULE_KEY.SALES_RETURN_STORE_CREDIT_NEEDS_CONTACT);
  }
  return method;
}

function isAcceptedRefundMethod(method: PaymentMethod): method is SalesReturnRefundMethod {
  return (Object.values(SALES_RETURN_REFUND_METHOD) as string[]).includes(method);
}

export function requireActor(actorUserId: UserId | null): UserId {
  if (actorUserId === null) throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
  return actorUserId;
}
