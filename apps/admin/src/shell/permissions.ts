import type { CallerPermissionsResponse, PermissionKey } from "@banijjik/contracts";

/**
 * True when the caller holds the key at every location or at least one. The API still checks the
 * permission at the exact location; this only decides what the screen offers (hiding is never protection).
 */
export function holdsPermission(
  permissions: CallerPermissionsResponse,
  permissionKey: PermissionKey,
): boolean {
  if (permissions.allLocations.includes(permissionKey)) return true;
  return Object.values(permissions.byLocation).some((keys) => keys.includes(permissionKey));
}

/** True when the caller holds the key at every location, as the "All locations" assignment needs. */
export function holdsPermissionEverywhere(
  permissions: CallerPermissionsResponse,
  permissionKey: PermissionKey,
): boolean {
  return permissions.allLocations.includes(permissionKey);
}

/** True when the caller holds the key at this one location, or at every location. */
export function holdsPermissionAt(
  permissions: CallerPermissionsResponse,
  permissionKey: PermissionKey,
  locationId: string,
): boolean {
  if (permissions.allLocations.includes(permissionKey)) return true;
  return permissions.byLocation[locationId]?.includes(permissionKey) ?? false;
}
