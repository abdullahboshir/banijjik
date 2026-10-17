/** Message keys the organization tenant endpoints (card 1.7b) can send to a client. Both catalogs need each. */
export const ORGANIZATION_API_MESSAGE_KEYS: readonly string[] = [
  "errors.location_in_use",
  "errors.location_is_default",
  "errors.owner_is_protected",
  "errors.cannot_change_self",
  "errors.role_not_grantable",
  "errors.invitation_identifier_mismatch",
  "errors.custom_field_sensitive_forbidden",
];
