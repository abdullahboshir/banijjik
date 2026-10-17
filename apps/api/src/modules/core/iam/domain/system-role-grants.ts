import {
  permissionAction,
  permissionModuleKey,
  PERMISSION_KEY,
  SYSTEM_ROLE_KEY,
  type PermissionKey,
  type SystemRoleKey,
} from "@banijjik/contracts";

/**
 * What a system role gets from one module (10-MODULE-CATALOG section 10).
 * "READ" is every key of the module whose action is `read`.
 */
export type GrantSpec =
  | "ALL"
  | "READ"
  | "NONE"
  | { readonly only: readonly PermissionKey[] }
  | { readonly allExcept: readonly PermissionKey[] };

type ModuleGrants = Readonly<Record<SystemRoleKey, GrantSpec>>;

/**
 * The code template of the six system roles, one row per module (ADR-054). A release that changes
 * a row applies to every organization without a migration. A module card adds its row, add-only.
 * OWNER is listed for readability; its keys are always computed as the whole catalogue.
 */
export const SYSTEM_ROLE_GRANTS: Readonly<Record<string, ModuleGrants>> = {
  organization: {
    [SYSTEM_ROLE_KEY.OWNER]: "ALL",
    [SYSTEM_ROLE_KEY.MANAGER]: {
      allExcept: [
        PERMISSION_KEY.ORGANIZATION_OWNERSHIP_TRANSFER,
        PERMISSION_KEY.ORGANIZATION_MEMBER_READ_SENSITIVE,
      ],
    },
    [SYSTEM_ROLE_KEY.CASHIER]: "NONE",
    [SYSTEM_ROLE_KEY.STAFF]: "NONE",
    [SYSTEM_ROLE_KEY.RIDER]: "NONE",
    [SYSTEM_ROLE_KEY.VIEWER]: { only: [PERMISSION_KEY.ORGANIZATION_LOCATION_READ] },
  },
  iam: {
    [SYSTEM_ROLE_KEY.OWNER]: "ALL",
    [SYSTEM_ROLE_KEY.MANAGER]: "READ",
    [SYSTEM_ROLE_KEY.CASHIER]: "NONE",
    [SYSTEM_ROLE_KEY.STAFF]: "NONE",
    [SYSTEM_ROLE_KEY.RIDER]: "NONE",
    [SYSTEM_ROLE_KEY.VIEWER]: "NONE",
  },
  audit: {
    [SYSTEM_ROLE_KEY.OWNER]: "ALL",
    [SYSTEM_ROLE_KEY.MANAGER]: "READ",
    [SYSTEM_ROLE_KEY.CASHIER]: "NONE",
    [SYSTEM_ROLE_KEY.STAFF]: "NONE",
    [SYSTEM_ROLE_KEY.RIDER]: "NONE",
    [SYSTEM_ROLE_KEY.VIEWER]: "NONE",
  },
  "custom-field": {
    [SYSTEM_ROLE_KEY.OWNER]: "ALL",
    [SYSTEM_ROLE_KEY.MANAGER]: "ALL",
    [SYSTEM_ROLE_KEY.CASHIER]: "READ",
    [SYSTEM_ROLE_KEY.STAFF]: "READ",
    [SYSTEM_ROLE_KEY.RIDER]: "NONE",
    [SYSTEM_ROLE_KEY.VIEWER]: "READ",
  },
  file: {
    [SYSTEM_ROLE_KEY.OWNER]: "ALL",
    [SYSTEM_ROLE_KEY.MANAGER]: "ALL",
    [SYSTEM_ROLE_KEY.CASHIER]: {
      only: [PERMISSION_KEY.FILE_ASSET_CREATE, PERMISSION_KEY.FILE_ASSET_READ],
    },
    [SYSTEM_ROLE_KEY.STAFF]: {
      only: [PERMISSION_KEY.FILE_ASSET_CREATE, PERMISSION_KEY.FILE_ASSET_READ],
    },
    [SYSTEM_ROLE_KEY.RIDER]: "NONE",
    [SYSTEM_ROLE_KEY.VIEWER]: "READ",
  },
  settings: {
    [SYSTEM_ROLE_KEY.OWNER]: "ALL",
    [SYSTEM_ROLE_KEY.MANAGER]: "ALL",
    [SYSTEM_ROLE_KEY.CASHIER]: "READ",
    [SYSTEM_ROLE_KEY.STAFF]: "READ",
    [SYSTEM_ROLE_KEY.RIDER]: "NONE",
    [SYSTEM_ROLE_KEY.VIEWER]: "READ",
  },
};

const READ_ACTION = "read";

function keysOfSpec(spec: GrantSpec, moduleKeys: readonly PermissionKey[]): PermissionKey[] {
  if (spec === "ALL") return [...moduleKeys];
  if (spec === "NONE") return [];
  if (spec === "READ") return moduleKeys.filter((key) => permissionAction(key) === READ_ACTION);
  if ("only" in spec) return moduleKeys.filter((key) => spec.only.includes(key));
  return moduleKeys.filter((key) => !spec.allExcept.includes(key));
}

export function isSystemRoleKey(roleKey: string): roleKey is SystemRoleKey {
  return Object.values<string>(SYSTEM_ROLE_KEY).includes(roleKey);
}

/**
 * The permission keys a system role holds, out of the keys that exist. OWNER always has every key,
 * including those of modules added later. Any module without a row grants the other roles nothing.
 */
export function grantedKeysOf(
  roleKey: SystemRoleKey,
  catalogKeys: readonly PermissionKey[],
): ReadonlySet<PermissionKey> {
  if (roleKey === SYSTEM_ROLE_KEY.OWNER) return new Set(catalogKeys);
  const granted = new Set<PermissionKey>();
  for (const [moduleKey, grants] of Object.entries(SYSTEM_ROLE_GRANTS)) {
    const moduleKeys = catalogKeys.filter((key) => permissionModuleKey(key) === moduleKey);
    for (const key of keysOfSpec(grants[roleKey], moduleKeys)) granted.add(key);
  }
  return granted;
}
