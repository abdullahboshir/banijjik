/** Business rule keys of the settings endpoints (`details.ruleKey` of a `422 BUSINESS_RULE`). */
export const SETTINGS_RULE_KEY = {
  SETTING_NOT_LOCATION_SCOPED: "SETTING_NOT_LOCATION_SCOPED",
  MODULE_NOT_TENANT_DISABLABLE: "MODULE_NOT_TENANT_DISABLABLE",
  MODULE_REQUIRED_BY: "MODULE_REQUIRED_BY",
} as const;

export type SettingsRuleKey = (typeof SETTINGS_RULE_KEY)[keyof typeof SETTINGS_RULE_KEY];
