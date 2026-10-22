/** Business-rule keys of the sales module (422 `details.ruleKey`). */
export const SALES_RULE_KEY = {
  KIND_NEEDS_BOOKING: "KIND_NEEDS_BOOKING",
  FULFILLMENT_METHOD_UNSUPPORTED: "FULFILLMENT_METHOD_UNSUPPORTED",
  ADVANCE_NEEDS_PAYMENTS: "ADVANCE_NEEDS_PAYMENTS",
} as const;

export type SalesRuleKey = (typeof SALES_RULE_KEY)[keyof typeof SALES_RULE_KEY];

/** Message keys the sales module sends, besides the kernel codes. Both catalogs need each. */
export const SALES_MESSAGE_KEYS: readonly string[] = [
  "errors.kind_needs_booking",
  "errors.fulfillment_method_unsupported",
  "errors.advance_needs_payments",
];
