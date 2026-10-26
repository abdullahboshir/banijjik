import type {
  CallerPermissionsResponse,
  LocationResponse,
  PermissionKey,
} from "@banijjik/contracts";

/**
 * The locations the caller may read with this permission. The API still checks each request (ADR-004);
 * this only decides which locations the filter offers.
 */
export function locationsWithPermission(
  permissions: CallerPermissionsResponse,
  permissionKey: PermissionKey,
  locations: readonly LocationResponse[],
): readonly LocationResponse[] {
  if (permissions.allLocations.includes(permissionKey)) return locations;
  return locations.filter((location) =>
    permissions.byLocation[location.locationId]?.includes(permissionKey),
  );
}

/** The location filter shows only for a member with more than one location (plan 3.10 decision 10). */
export function showsLocationFilter(
  permissions: CallerPermissionsResponse,
  permissionKey: PermissionKey,
  locations: readonly LocationResponse[],
): boolean {
  return locationsWithPermission(permissions, permissionKey, locations).length > 1;
}
