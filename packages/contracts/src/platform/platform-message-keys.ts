/** `details.ruleKey` of a `422 BUSINESS_RULE` from the platform endpoints. */
export const PLATFORM_RULE_KEY = {
  PACKAGE_IN_USE: "PACKAGE_IN_USE",
  PACKAGE_NOT_CLOSED: "PACKAGE_NOT_CLOSED",
  MODULE_NOT_REGISTERED: "MODULE_NOT_REGISTERED",
  MODULE_CLASS_FIXED: "MODULE_CLASS_FIXED",
  TRIAL_NOT_ACTIVE: "TRIAL_NOT_ACTIVE",
  PACKAGE_KIND_MISMATCH: "PACKAGE_KIND_MISMATCH",
  OPERATOR_USER_NOT_FOUND: "OPERATOR_USER_NOT_FOUND",
  OPERATOR_USER_NOT_ACTIVE: "OPERATOR_USER_NOT_ACTIVE",
  OWN_OPERATOR_ACCESS: "OWN_OPERATOR_ACCESS",
  INDUSTRY_TEMPLATE_CHANGE_NOT_ADDITIVE: "INDUSTRY_TEMPLATE_CHANGE_NOT_ADDITIVE",
  INDUSTRY_TEMPLATE_STATUS_INVALID: "INDUSTRY_TEMPLATE_STATUS_INVALID",
} as const;

export type PlatformRuleKey = (typeof PLATFORM_RULE_KEY)[keyof typeof PLATFORM_RULE_KEY];

/** Message keys the platform endpoints can send to a client. Both catalogs need each. */
export const PLATFORM_MESSAGE_KEYS: readonly string[] = [
  "errors.package_in_use",
  "errors.package_not_closed",
  "errors.module_not_registered",
  "errors.module_class_fixed",
  "errors.trial_not_active",
  "errors.package_kind_mismatch",
  "errors.package_archived",
  "errors.operator_exists",
  "errors.operator_user_not_found",
  "errors.operator_user_not_active",
  "errors.own_operator_access",
  "errors.industry_template_key_taken",
  "errors.industry_template_change_not_additive",
  "errors.industry_template_status_invalid",
];
