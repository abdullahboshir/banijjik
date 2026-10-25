/** Business-rule keys of the sales module (422 `details.ruleKey`). */
export const SALES_RULE_KEY = {
  ORDER_CONTACT_LOCKED_BY_PAYMENT: "ORDER_CONTACT_LOCKED_BY_PAYMENT",
  ORDER_TOTAL_BELOW_PAID: "ORDER_TOTAL_BELOW_PAID",
  ORDER_CANCEL_NEEDS_CONTACT: "ORDER_CANCEL_NEEDS_CONTACT",
  KIND_NEEDS_BOOKING: "KIND_NEEDS_BOOKING",
  FULFILLMENT_METHOD_UNSUPPORTED: "FULFILLMENT_METHOD_UNSUPPORTED",
  ADVANCE_NEEDS_PAYMENTS: "ADVANCE_NEEDS_PAYMENTS",
  CONTACT_PHONE_REQUIRED: "CONTACT_PHONE_REQUIRED",
  /** Placing an order without any line (plan 3.5a transition table: place needs ≥ 1 line). */
  ORDER_NEEDS_LINE: "ORDER_NEEDS_LINE",
  /** `POST …/pack` when `sales.usePacking` is off (plan 3.5a transition table). */
  PACKING_DISABLED: "PACKING_DISABLED",
  /** A line names a performer who is not an active member assigned at the order's location (ADR-135). */
  SALES_PERFORMER_NOT_AT_LOCATION: "SALES_PERFORMER_NOT_AT_LOCATION",
  /** A return asked after the organization's return window (sales.returnWindowDays). */
  SALES_RETURN_WINDOW_CLOSED: "SALES_RETURN_WINDOW_CLOSED",
  /** A return on an order that is not COMPLETED. */
  SALES_RETURN_ORDER_NOT_RETURNABLE: "SALES_RETURN_ORDER_NOT_RETURNABLE",
  /** A return line asks for more than is left on the order line. */
  SALES_RETURN_QUANTITY_ABOVE_SOLD: "SALES_RETURN_QUANTITY_ABOVE_SOLD",
  /** A refund is due but no refund method was named. */
  SALES_RETURN_REFUND_METHOD_REQUIRED: "SALES_RETURN_REFUND_METHOD_REQUIRED",
  /** The refund method is known but not offered yet (GATEWAY until Phase 5). */
  PAYMENT_METHOD_NOT_AVAILABLE: "PAYMENT_METHOD_NOT_AVAILABLE",
  /** A reason OTHER on a return needs a note. */
  SALES_RETURN_OTHER_REASON_NEEDS_NOTE: "SALES_RETURN_OTHER_REASON_NEEDS_NOTE",
  /** A store-credit refund of a return needs a contact on the order (plan 3.5b amendment 2). */
  SALES_RETURN_STORE_CREDIT_NEEDS_CONTACT: "SALES_RETURN_STORE_CREDIT_NEEDS_CONTACT",
  SALES_RETURN_EXCHANGE_NOT_REVERSIBLE: "SALES_RETURN_EXCHANGE_NOT_REVERSIBLE",
  SALES_RETURN_STOCK_GONE: "SALES_RETURN_STOCK_GONE",
  SALES_RETURN_REVERSE_ORDER_NOT_COMPLETED: "SALES_RETURN_REVERSE_ORDER_NOT_COMPLETED",
} as const;

export type SalesRuleKey = (typeof SALES_RULE_KEY)[keyof typeof SALES_RULE_KEY];

/** Message keys the sales module sends, besides the kernel codes. Both catalogs need each. */
export const SALES_MESSAGE_KEYS: readonly string[] = [
  "errors.order_contact_locked_by_payment",
  "errors.order_total_below_paid",
  "errors.order_cancel_needs_contact",
  "errors.kind_needs_booking",
  "errors.fulfillment_method_unsupported",
  "errors.advance_needs_payments",
  "errors.order_contact_phone_required",
  "errors.order_needs_line",
  "errors.packing_disabled",
  "errors.sales_performer_not_at_location",
  "errors.sales_return_window_closed",
  "errors.sales_return_order_not_returnable",
  "errors.sales_return_quantity_above_sold",
  "errors.sales_return_refund_method_required",
  "errors.payment_method_not_available",
  "errors.sales_return_other_reason_needs_note",
  "errors.sales_return_duplicate_line",
  "errors.sales_return_store_credit_needs_contact",
  "errors.sales_return_exchange_not_reversible",
  "errors.sales_return_stock_gone",
  "errors.sales_return_reverse_order_not_completed",
];
