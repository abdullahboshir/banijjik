import type { PlatformPermissionKey } from "@banijjik/contracts";

/** What the screens show comes from the permissions the API sent; the API enforces them again (ADR-093). */
export function holdsPermission(
  operator: { permissions: readonly PlatformPermissionKey[] },
  permissionKey: PlatformPermissionKey,
): boolean {
  return operator.permissions.includes(permissionKey);
}
