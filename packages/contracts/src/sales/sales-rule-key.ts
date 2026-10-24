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
];
