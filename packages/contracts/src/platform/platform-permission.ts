import { PLATFORM_ROLE, type PlatformRole } from "../iam/platform-role.js";

/**
 * Permission keys of the platform panel, `platform.<module>.<action>` (ADR-054, ADR-093). They are
 * not business permissions: no tenant role can hold them, and they come only from the platform
 * roles of a PlatformOperator.
 */
export const PLATFORM_PERMISSION_KEY = {
  TENANT_READ: "platform.tenant.read",
  TENANT_SUSPEND: "platform.tenant.suspend",
  PACKAGE_READ: "platform.package.read",
  PACKAGE_WRITE: "platform.package.write",
  ENTITLEMENT_READ: "platform.entitlement.read",
  ENTITLEMENT_WRITE: "platform.entitlement.write",
  SUBSCRIPTION_READ: "platform.subscription.read",
  SUBSCRIPTION_WRITE: "platform.subscription.write",
  AUDIT_READ: "platform.audit.read",
} as const;

export type PlatformPermissionKey =
  (typeof PLATFORM_PERMISSION_KEY)[keyof typeof PLATFORM_PERMISSION_KEY];

const ALL_PLATFORM_PERMISSIONS: readonly PlatformPermissionKey[] =
  Object.values(PLATFORM_PERMISSION_KEY);

/**
 * What each platform role may do (ADR-093, final). A code template, like the system roles of
 * tenants (ADR-088): a release that changes it applies to every operator without a migration.
 * `package.write` is SUPER_ADMIN only: a package definition changes every tenant on it.
 */
export const PLATFORM_ROLE_PERMISSIONS: Readonly<
  Record<PlatformRole, readonly PlatformPermissionKey[]>
> = Object.freeze({
  [PLATFORM_ROLE.SUPER_ADMIN]: ALL_PLATFORM_PERMISSIONS,
  [PLATFORM_ROLE.SUPPORT]: [
    PLATFORM_PERMISSION_KEY.TENANT_READ,
    PLATFORM_PERMISSION_KEY.TENANT_SUSPEND,
    PLATFORM_PERMISSION_KEY.PACKAGE_READ,
    PLATFORM_PERMISSION_KEY.ENTITLEMENT_READ,
    PLATFORM_PERMISSION_KEY.SUBSCRIPTION_READ,
  ],
  [PLATFORM_ROLE.BILLING]: [
    PLATFORM_PERMISSION_KEY.TENANT_READ,
    PLATFORM_PERMISSION_KEY.PACKAGE_READ,
    PLATFORM_PERMISSION_KEY.ENTITLEMENT_READ,
    PLATFORM_PERMISSION_KEY.ENTITLEMENT_WRITE,
    PLATFORM_PERMISSION_KEY.SUBSCRIPTION_READ,
    PLATFORM_PERMISSION_KEY.SUBSCRIPTION_WRITE,
  ],
});

/** The union of the permissions of all the given roles. */
export function platformPermissionsOf(
  platformRoles: readonly PlatformRole[],
): ReadonlySet<PlatformPermissionKey> {
  return new Set(platformRoles.flatMap((role) => PLATFORM_ROLE_PERMISSIONS[role]));
}
