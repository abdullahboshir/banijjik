/** Message keys the iam module can send to a client, in addition to the kernel ones. Both catalogs need each. */
export const IAM_MESSAGE_KEYS: readonly string[] = [
  "errors.invalid_credentials",
  "errors.account_locked",
  "errors.account_disabled",
  "errors.origin_not_allowed",
  "validation.password_too_short",
  "validation.password_too_long",
  "validation.password_too_similar",
  "validation.identifier_required",
];
