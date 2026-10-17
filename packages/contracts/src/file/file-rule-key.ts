/** Business-rule keys of the file module (422 `details.ruleKey`). */
export const FILE_RULE_KEY = {
  FILE_QUOTA_EXCEEDED: "FILE_QUOTA_EXCEEDED",
} as const;

export type FileRuleKey = (typeof FILE_RULE_KEY)[keyof typeof FILE_RULE_KEY];

/** Message keys this module sends, besides the kernel codes. Both catalogs need each. */
export const FILE_MESSAGE_KEYS: readonly string[] = [
  "errors.file_type_not_allowed",
  "errors.file_too_large",
  "errors.file_quota_exceeded",
  "errors.file_upload_invalid",
  "errors.file_reference_invalid",
];
