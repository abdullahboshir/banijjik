/** Business-rule keys of the catalog (422 `details.ruleKey`). */
export const CATALOG_RULE_KEY = {
  STOCK_COMPONENTS_NEED_INVENTORY: "STOCK_COMPONENTS_NEED_INVENTORY",
  CATEGORY_IN_USE: "CATEGORY_IN_USE",
} as const;

export type CatalogRuleKey = (typeof CATALOG_RULE_KEY)[keyof typeof CATALOG_RULE_KEY];

/** Message keys the catalog sends, besides the kernel codes. Both catalogs need each. */
export const CATALOG_MESSAGE_KEYS: readonly string[] = [
  "errors.offering_slug_taken",
  "errors.offering_sku_taken",
  "errors.offering_kind_not_allowed",
  "errors.offering_currency_mismatch",
  "errors.offering_reference_invalid",
  "errors.offering_variant_unknown",
  "errors.offering_variant_duplicate_options",
  "errors.offering_stock_components_need_inventory",
  "errors.category_in_use",
  "errors.category_too_deep",
  "errors.category_cycle",
  "errors.modifier_group_selection_invalid",
];
