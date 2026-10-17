/**
 * Every permission key of the modules that exist (10-MODULE-CATALOG section 7, ADR-054).
 * A key is `<moduleKey>.<entity>.<action>`. A later module card adds its own keys here, add-only.
 */
export const PERMISSION_KEY = {
  IAM_ROLE_READ: "iam.role.read",
  IAM_ROLE_CREATE: "iam.role.create",
  IAM_ROLE_UPDATE: "iam.role.update",
  IAM_ROLE_ARCHIVE: "iam.role.archive",
  ORGANIZATION_PROFILE_UPDATE: "organization.profile.update",
  ORGANIZATION_LOCATION_READ: "organization.location.read",
  ORGANIZATION_LOCATION_CREATE: "organization.location.create",
  ORGANIZATION_LOCATION_UPDATE: "organization.location.update",
  ORGANIZATION_LOCATION_ARCHIVE: "organization.location.archive",
  ORGANIZATION_MEMBER_READ: "organization.member.read",
  ORGANIZATION_MEMBER_INVITE: "organization.member.invite",
  ORGANIZATION_MEMBER_UPDATE: "organization.member.update",
  ORGANIZATION_MEMBER_REMOVE: "organization.member.remove",
  ORGANIZATION_MEMBER_READ_SENSITIVE: "organization.member.readSensitive",
  ORGANIZATION_OWNERSHIP_TRANSFER: "organization.ownership.transfer",
  AUDIT_LOG_READ: "audit.log.read",
  CUSTOM_FIELD_DEFINITION_READ: "custom-field.definition.read",
  CUSTOM_FIELD_DEFINITION_CREATE: "custom-field.definition.create",
  CUSTOM_FIELD_DEFINITION_UPDATE: "custom-field.definition.update",
  CUSTOM_FIELD_DEFINITION_ARCHIVE: "custom-field.definition.archive",
  FILE_ASSET_READ: "file.asset.read",
  FILE_ASSET_CREATE: "file.asset.create",
  FILE_ASSET_DELETE: "file.asset.delete",
  SETTINGS_SETTING_READ: "settings.setting.read",
  SETTINGS_SETTING_UPDATE: "settings.setting.update",
  SETTINGS_TERM_UPDATE: "settings.term.update",
  SETTINGS_MODULE_UPDATE: "settings.module.update",
} as const;

export type PermissionKey = (typeof PERMISSION_KEY)[keyof typeof PERMISSION_KEY];

/** `<moduleKey>.<entity>.<action>`: a kebab-case module key, then two camelCase words (ADR-054). */
export const PERMISSION_KEY_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;

const PERMISSION_KEY_VALUES: readonly string[] = Object.values(PERMISSION_KEY);

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_VALUES.includes(value);
}

/** Message key of a permission's label in the role editor, e.g. `permission.iam.role.read`. */
export function permissionLabelKey(permissionKey: PermissionKey): string {
  return `permission.${permissionKey}`;
}

/** The module part of a key. */
export function permissionModuleKey(permissionKey: string): string {
  return permissionKey.split(".")[0] ?? "";
}

/** The last part of a key; `read` marks the read permissions of a module. */
export function permissionAction(permissionKey: string): string {
  return permissionKey.split(".")[2] ?? "";
}

/** Every permission label key, so both catalogs can be checked against it. */
export const PERMISSION_LABEL_MESSAGE_KEYS: readonly string[] = Object.values(PERMISSION_KEY).map(
  (permissionKey) => permissionLabelKey(permissionKey),
);

/**
 * Permissions over records of the whole organization (the profile, the audit log, the locations and
 * the roles). The API refuses them unless they are held at every location (`requireAllLocations`, review M3), so `/me/config`
 * reports them only when they are held at ALL and the menu never offers what the API refuses.
 */
export const ORGANIZATION_WIDE_PERMISSION_KEYS: readonly PermissionKey[] = [
  PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE,
  PERMISSION_KEY.AUDIT_LOG_READ,
  PERMISSION_KEY.ORGANIZATION_LOCATION_CREATE,
  PERMISSION_KEY.ORGANIZATION_LOCATION_UPDATE,
  PERMISSION_KEY.ORGANIZATION_LOCATION_ARCHIVE,
  PERMISSION_KEY.IAM_ROLE_CREATE,
  PERMISSION_KEY.IAM_ROLE_UPDATE,
  PERMISSION_KEY.IAM_ROLE_ARCHIVE,
  // Definitions are organization-wide, so these writes need the permission at every location.
  PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_CREATE,
  PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_UPDATE,
  PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_ARCHIVE,
  PERMISSION_KEY.SETTINGS_TERM_UPDATE,
  PERMISSION_KEY.SETTINGS_MODULE_UPDATE,
];
