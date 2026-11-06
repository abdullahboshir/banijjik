import type { OfferingKind } from "@banijjik/contracts";
import type { StockComponent } from "@banijjik/contracts/catalog";
import type { ManualDiscount } from "@banijjik/contracts/pricing";
import type {
  DeliveryAddress,
  FirstShipmentPostingFacts,
} from "@banijjik/contracts/sales/delivery";
import {
  FULFILLMENT_METHOD,
  ORDER_RETURN_STATUS,
  ORDER_STATUS,
  type FulfillmentMethod,
  type Money,
  type OrderApproval,
  type OrderFulfillment,
  type OrderLineModifierSnapshot,
  type OrderSource,
  type OrderReturnStatus,
  type OrderStatus,
  type OrderTotals,
} from "@banijjik/contracts/sales";
import type { CheckoutRecipientSnapshot } from "@banijjik/contracts/website";
import type { ContactId, LocationId, OrderId, OrganizationId, UserId } from "@banijjik/ids";
import {
  deliveryAddressRequired,
  deliveryMethodNotCompletable,
  dispatchMethodMismatch,
  invalidTransition,
} from "./errors.js";

/**
 * A stored line. `manualDiscount` is kept outside the response snapshot so an edit can re-quote
 * exactly what the seller entered; the client never sends money, only this input.
 */
export interface OrderLineProps {
  readonly orderLineId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly kind: OfferingKind;
  readonly nameSnapshot: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly listUnitPrice: Money;
  readonly unitPriceOverride: Money | null;
  readonly lineGross: Money;
  readonly lineDiscount: Money;
  readonly lineTax: Money;
  readonly lineNetTotal: Money;
  readonly unitCostSnapshot: Money | null;
  readonly modifiers: readonly OrderLineModifierSnapshot[];
  readonly returnedQuantity: number;
  readonly promotionIds: readonly string[];
  readonly taxClassKey: string | null;
  /** Internal like `manualDiscount`: what the line draws from stock, for the commit-time cost. */
  readonly costComponents: readonly StockComponent[];
  readonly manualDiscount: ManualDiscount | null;
  /** The member who performed the line; commission accrues to them (ADR-135). Null for a line without one. */
  readonly performedByMemberId: string | null;
}

export interface OrderProps {
  readonly orderId: OrderId;
  readonly organizationId: OrganizationId;
  readonly orderNumber: string | null;
  readonly invoiceNumber: string | null;
  readonly locationId: LocationId;
  readonly contactId: ContactId | null;
  readonly status: OrderStatus;
  readonly lines: readonly OrderLineProps[];
  readonly totals: OrderTotals;
  readonly fulfillment: OrderFulfillment;
  readonly deliveryAddress: DeliveryAddress | null;
  readonly deliveryZoneId: string | null;
  readonly shippedAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly firstShipment: FirstShipmentPostingFacts | null;
  readonly currentDeliveryAttemptId: string | null;
  readonly deliveryAttemptCount: number;
  readonly businessDate: string;
  readonly source: OrderSource;
  readonly approval: OrderApproval | null;
  readonly note: string | null;
  readonly orderDiscount: ManualDiscount | null;
  readonly cancelReason: string | null;
  readonly customFields: Readonly<Record<string, unknown>>;
  /**
   * The POS register that sold this order (plan 3.9 A2-6). Null for every order not rung up at a
   * till, which is what lets the Z-report count a credit sale that has no payment of its own.
   */
  readonly posSessionId: string | null;
  /** Linked storefront checkout id when created via customer checkout (card 4.3). */
  readonly checkoutId: string | null;
  /** Verified recipient snapshot when submitted via customer checkout (card 4.3). */
  readonly recipient: CheckoutRecipientSnapshot | null;
  /**
   * Whether the order holds a stock reservation (tracked lines were reserved at place). Complete
   * and cancel need it because the stock port cannot answer "is there a reservation?".
   */
  readonly hasStockLines: boolean;
  /** NONE until a return; moved by the return use cases with one versioned order write (plan 3.5b decision 7). */
  readonly returnStatus: OrderReturnStatus;
  /** When the order reached COMPLETED; the return window counts from it (plan 3.5b decision 2). */
  readonly completedAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export interface NewOrderInput {
  readonly orderId: OrderId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly contactId: ContactId | null;
  readonly fulfillment: OrderFulfillment;
  /** Optional so instant/PICKUP callers stay unchanged; Order.createDraft fills null. */
  readonly deliveryAddress?: DeliveryAddress | null;
  readonly deliveryZoneId?: string | null;
  readonly lines: readonly OrderLineProps[];
  readonly totals: OrderTotals;
  readonly businessDate: string;
  readonly source: OrderSource;
  readonly note: string | null;
  readonly orderDiscount: ManualDiscount | null;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly hasStockLines: boolean;
  readonly posSessionId: string | null;
  readonly checkoutId?: string | null;
  readonly recipient?: CheckoutRecipientSnapshot | null;
  readonly createdByUserId: UserId | null;
  readonly now: Date;
}

export interface OrderContentChanges {
  readonly contactId?: ContactId | null;
  readonly lines?: readonly OrderLineProps[];
  readonly totals?: OrderTotals;
  readonly orderDiscount?: ManualDiscount | null;
  readonly note?: string | null;
  readonly customFields?: Readonly<Record<string, unknown>>;
  readonly hasStockLines?: boolean;
  /** Built from the PATCH body's `fulfillmentMethod` as `{ method }`. */
  readonly fulfillment?: OrderFulfillment;
  readonly deliveryAddress?: DeliveryAddress | null;
  readonly deliveryZoneId?: string | null;
}

export interface OrderTransitionActor {
  readonly actorUserId: UserId | null;
  readonly now: Date;
}

const INITIAL_VERSION = 1;

/** Defaults the five delivery facts and the DRAFT status so `Order.createDraft` stays small. */
export function draftOrderProps(input: NewOrderInput): OrderProps {
  return {
    orderId: input.orderId,
    organizationId: input.organizationId,
    orderNumber: null,
    invoiceNumber: null,
    locationId: input.locationId,
    contactId: input.contactId,
    status: ORDER_STATUS.DRAFT,
    lines: input.lines,
    totals: input.totals,
    fulfillment: input.fulfillment,
    deliveryAddress: input.deliveryAddress ?? null,
    deliveryZoneId: input.deliveryZoneId ?? null,
    shippedAt: null,
    deliveredAt: null,
    firstShipment: null,
    currentDeliveryAttemptId: null,
    deliveryAttemptCount: 0,
    businessDate: input.businessDate,
    source: input.source,
    approval: null,
    note: input.note,
    orderDiscount: input.orderDiscount,
    cancelReason: null,
    customFields: input.customFields,
    posSessionId: input.posSessionId,
    checkoutId: input.checkoutId ?? null,
    recipient: input.recipient ?? null,
    hasStockLines: input.hasStockLines,
    returnStatus: ORDER_RETURN_STATUS.NONE,
    completedAt: null,
    version: INITIAL_VERSION,
    createdAt: input.now,
    updatedAt: input.now,
    createdByUserId: input.createdByUserId,
    updatedByUserId: input.createdByUserId,
  };
}

/** `null` clears an optional value, `undefined` keeps it. */
export function cleared<Value>(change: Value | null | undefined, current: Value | null): Value | null {
  if (change === undefined) return current;
  return change;
}

/** NONE before any return, FULL once every unit of every line came back, PARTIAL otherwise. */
export function returnStatusOfLines(lines: readonly OrderLineProps[]): OrderProps["returnStatus"] {
  const returned = lines.reduce((total, line) => total + line.returnedQuantity, 0);
  if (returned === 0) return ORDER_RETURN_STATUS.NONE;
  const everyLineFull = lines.every((line) => line.returnedQuantity >= line.quantity);
  return everyLineFull ? ORDER_RETURN_STATUS.FULL : ORDER_RETURN_STATUS.PARTIAL;
}

export function lineKey(line: { readonly offeringId: string; readonly variantId: string }): string {
  return `${line.offeringId}:${line.variantId}`;
}

export function assertStatus(status: OrderStatus, allowed: readonly OrderStatus[]): void {
  if (!allowed.includes(status)) throw invalidTransition(status);
}

export function isDeliveryMethod(method: string): boolean {
  return method === FULFILLMENT_METHOD.COURIER || method === FULFILLMENT_METHOD.OWN_RIDER;
}

export function assertDeliveryFulfillable(order: OrderProps): void {
  if (isDeliveryMethod(order.fulfillment.method) && order.deliveryAddress === null) {
    throw deliveryAddressRequired();
  }
}

export function assertNotDelivery(method: string): void {
  if (isDeliveryMethod(method)) {
    throw deliveryMethodNotCompletable(method);
  }
}

export function assertDeliveryDispatch(order: OrderProps, dispatchMethod: FulfillmentMethod): void {
  if (!isDeliveryMethod(order.fulfillment.method)) {
    throw deliveryMethodNotCompletable(order.fulfillment.method);
  }
  if (dispatchMethod !== order.fulfillment.method) {
    throw dispatchMethodMismatch(order.fulfillment.method, dispatchMethod);
  }
  if (order.deliveryAddress === null) {
    throw deliveryAddressRequired();
  }
}
