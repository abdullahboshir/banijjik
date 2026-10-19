/** Business-rule keys of the pricing module (422 `details.ruleKey`). */
export const PRICING_RULE_KEY = {
  TAX_CLASS_UNKNOWN: "TAX_CLASS_UNKNOWN",
  OFFERING_NOT_AVAILABLE: "OFFERING_NOT_AVAILABLE",
  TAX_CLASS_KEY_TAKEN: "TAX_CLASS_KEY_TAKEN",
} as const;

export type PricingRuleKey = (typeof PRICING_RULE_KEY)[keyof typeof PRICING_RULE_KEY];

/** Message keys the pricing module sends, besides the kernel codes. Both catalogs need each. */
export const PRICING_MESSAGE_KEYS: readonly string[] = [
  "errors.tax_class_unknown",
  "errors.offering_not_available",
  "errors.tax_class_key_taken",
  "errors.promotion_currency_mismatch",
  "errors.quote_quantity_invalid",
  "errors.quote_modifier_invalid",
];
