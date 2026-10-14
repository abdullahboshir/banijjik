/** Business-rule keys of the custom field engine (422 `details.ruleKey`). */
export const CUSTOM_FIELD_RULE_KEY = {
  CUSTOM_FIELD_LIMIT: "CUSTOM_FIELD_LIMIT",
  CUSTOM_FIELD_REQUIRED: "CUSTOM_FIELD_REQUIRED",
  CUSTOM_FIELD_OPTIONS_LOCKED: "CUSTOM_FIELD_OPTIONS_LOCKED",
} as const;

export type CustomFieldRuleKey = (typeof CUSTOM_FIELD_RULE_KEY)[keyof typeof CUSTOM_FIELD_RULE_KEY];

/** Message keys this module sends, besides the kernel codes. Both catalogs need each. */
export const CUSTOM_FIELD_MESSAGE_KEYS: readonly string[] = [
  "errors.custom_field_key_taken",
  "errors.custom_field_limit",
  "errors.custom_field_required",
  "errors.custom_field_options_locked",
];
