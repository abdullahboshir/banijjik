import { defineEnum } from "../define-enum.js";
import type { OfferingKind } from "../modules/offering-kind.js";
import type { ApprovalAction, ManualDiscount, Money } from "../pricing/pricing-contracts.js";
import type { OrderReturnStatus } from "./sales-return-contracts.js";

/**
 * The full lifecycle of 09-DOMAIN-MODEL section 5.5. Card 3.5a implements the six statuses in
 * `ORDER_IMPLEMENTED_STATUSES`; the shipping statuses stay declared and every transition into them
 * is refused until courier and rider fulfillment arrive (Phase 5).
 */
export const ORDER_STATUS = defineEnum([
  "DRAFT",
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "DELIVERY_FAILED",
  "RETURNED_TO_SENDER",
  "CANCELLED",
]);
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_IMPLEMENTED_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.DRAFT,
  ORDER_STATUS.PLACED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PACKED,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
];

export const ORDER_EDITABLE_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.DRAFT,
  ORDER_STATUS.PLACED,
  ORDER_STATUS.CONFIRMED,
];

/** Statuses whose reservation is still held and that a cancel releases (11 section 4.2). */
export const ORDER_CANCELLABLE_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.DRAFT,
  ORDER_STATUS.PLACED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PACKED,
];

/** Statuses that count against the monthly order limit (decision 7). */
export const ORDER_LIMIT_COUNTED_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.PLACED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PACKED,
  ORDER_STATUS.COMPLETED,
];

export const ORDER_SOURCE = defineEnum(["ADMIN", "STOREFRONT", "BOT", "API", "POS"]);
export type OrderSource = (typeof ORDER_SOURCE)[keyof typeof ORDER_SOURCE];

/** INSTANT and PICKUP are served by card 3.5a; COURIER and OWN_RIDER are declared and refused. */
export const FULFILLMENT_METHOD = defineEnum(["INSTANT", "PICKUP", "COURIER", "OWN_RIDER"]);
export type FulfillmentMethod = (typeof FULFILLMENT_METHOD)[keyof typeof FULFILLMENT_METHOD];

export const FULFILLMENT_METHODS_THIS_CARD: readonly FulfillmentMethod[] = [
  FULFILLMENT_METHOD.INSTANT,
  FULFILLMENT_METHOD.PICKUP,
];

/** Derived from payment allocations and refunds. */
export const PAYMENT_STATUS = defineEnum([
  "UNPAID",
  "PARTIAL",
  "PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const SALES_AUTO_CONFIRM_SETTING_KEY = "sales.autoConfirm";
export const SALES_DRAFT_EXPIRY_HOURS_SETTING_KEY = "sales.draftExpiryHours";
export const SALES_PLACED_AUTO_CANCEL_HOURS_SETTING_KEY = "sales.placedAutoCancelHours";
export const SALES_USE_PACKING_SETTING_KEY = "sales.usePacking";
export const SALES_DISCOUNT_OWNER_WITHOUT_APPROVAL_SETTING_KEY =
  "sales.discountOwnerWithoutApproval";
export const SALES_ADVANCE_REQUIRED_SETTING_KEY = "sales.advance.required";

export const SALES_AUTO_CONFIRM_DEFAULT = false;
export const SALES_DRAFT_EXPIRY_HOURS_DEFAULT = 48;
/** 0 means placed orders are never auto-cancelled. */
export const SALES_PLACED_AUTO_CANCEL_HOURS_DEFAULT = 0;
export const SALES_USE_PACKING_DEFAULT = false;
export const SALES_DISCOUNT_OWNER_WITHOUT_APPROVAL_DEFAULT = true;
export const SALES_ADVANCE_REQUIRED_DEFAULT = "NONE";

/** The advance required before confirming an order. */
export const SALES_ADVANCE_REQUIRED = defineEnum(["NONE", "FIXED", "PERCENT", "FULL"]);
export type SalesAdvanceRequired =
  (typeof SALES_ADVANCE_REQUIRED)[keyof typeof SALES_ADVANCE_REQUIRED];

export const MAX_ORDER_LINES = 100;
/** The performer picker lists at most this many members of a location; no paging (plan 3.11 Refresh C). */
export const MAX_ORDER_PERFORMERS = 100;
export const MAX_ORDER_CANCEL_REASON_LENGTH = 200;
export const MAX_ORDER_SEARCH_LENGTH = 120;
export const MAX_ORDER_NOTE_LENGTH = 500;

/**
 * Cancel reasons the system writes itself; the admin UI shows them through i18n (part B adds the
 * keys). A reason typed by staff stays free text.
 */
export const SALES_CANCEL_REASON = defineEnum(["AUTO_PLACED_TIMEOUT"]);
export type SalesCancelReason = (typeof SALES_CANCEL_REASON)[keyof typeof SALES_CANCEL_REASON];

/** Approval tokens cover one order: the subject key is `order:<orderId>`. */
export function orderApprovalSubject(orderId: string): string {
  return `order:${orderId}`;
}

/**
 * An instant sale is approved before the order exists, so its tokens share this subject. The token
 * is single-use and binds the approved discount amount (ADR-121), so one token still approves
 * exactly one sale at the approved size.
 */
export const INSTANT_ORDER_APPROVAL_SUBJECT = "order:instant";

export interface OrderLineModifierSnapshot {
  readonly modifierGroupId: string;
  readonly modifierOptionId: string;
  readonly nameSnapshot: string;
  readonly priceDelta: Money;
}

/** Prices, tax and the name are frozen at place time: later catalog changes never touch an order. */
export interface OrderLineSnapshot {
  readonly orderLineId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly kind: OfferingKind;
  readonly nameSnapshot: string;
  /** Integer in the sales unit's precision (ADR-047). */
  readonly quantity: number;
  readonly unitPrice: Money;
  /** The catalog unit price before a POS override (card 3.9 A2-2). */
  readonly listUnitPrice: Money;
  /** The POS unit price override when one was applied, or null (card 3.9 A2-2). */
  readonly unitPriceOverride: Money | null;
  readonly lineGross: Money;
  readonly lineDiscount: Money;
  readonly lineTax: Money;
  readonly lineNetTotal: Money;
  /** The inventory average cost at commit, filled when the order completes. */
  readonly unitCostSnapshot: Money | null;
  readonly modifiers: readonly OrderLineModifierSnapshot[];
  readonly returnedQuantity: number;
  readonly promotionIds: readonly string[];
  readonly taxClassKey: string | null;
  /** What the seller entered for this line; an edit re-quotes from it (ADR-131). */
  readonly manualDiscount: ManualDiscount | null;
  /** The member who performed or sold this line; commission accrues to them (ADR-135). Null when none. */
  readonly performedByMemberId: string | null;
}

/** One entry of the performer picker: a member's display name, never contact data (plan 3.11 Refresh C). */
export interface SalesPerformerResponse {
  readonly memberId: string;
  readonly name: string;
}

export interface OrderTotals {
  readonly subtotal: Money;
  readonly discountTotal: Money;
  readonly taxTotal: Money;
  readonly deliveryCharge: Money;
  readonly grandTotal: Money;
  readonly roundingAdjustment: Money;
}

export interface OrderFulfillment {
  readonly method: FulfillmentMethod;
}

export interface OrderApproval {
  readonly approverMemberId: string;
  readonly approvedAt: string;
  readonly action: ApprovalAction;
}

export interface OrderResponse {
  readonly orderId: string;
  /** Null while DRAFT; assigned from the ORDER sequence at PLACED. */
  readonly orderNumber: string | null;
  /** Assigned from the INVOICE sequence at COMPLETED. */
  readonly invoiceNumber: string | null;
  readonly locationId: string;
  readonly contactId: string | null;
  readonly contactName?: string | null;
  readonly status: OrderStatus;
  readonly lines: readonly OrderLineSnapshot[];
  readonly totals: OrderTotals;
  readonly fulfillment: OrderFulfillment;
  readonly paymentStatus: PaymentStatus;
  /** NONE until a return is made; old orders read NONE (plan 3.5b decision 7). */
  readonly returnStatus: OrderReturnStatus;
  readonly businessDate: string;
  readonly source: OrderSource;
  /** The register session that sold this order at the till, or null (card 3.9 A2-6). */
  readonly posSessionId?: string | null;
  readonly approval: OrderApproval | null;
  readonly note: string | null;
  /** What the seller entered for the whole order; an edit re-quotes from it (ADR-131). */
  readonly orderDiscount: ManualDiscount | null;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One row of the order list (decision 9): no line snapshots. */
export interface OrderListItem {
  readonly orderId: string;
  readonly orderNumber: string | null;
  readonly status: OrderStatus;
  readonly contactName: string | null;
  readonly grandTotal: Money;
  readonly paymentStatus: PaymentStatus;
  readonly createdAt: string;
}

export const SALES_ADVANCE_VALUE_SETTING_KEY = "sales.advance.value";
export const SALES_ADVANCE_VALUE_DEFAULT = 0;
