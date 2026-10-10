import type { AllowedLocations } from "../tenancy/tenant-scope.js";

/**
 * The locations the caller may use now and the locations where the permission is granted, as
 * one list. It only ever intersects: narrowing can never add a location the caller did not have.
 */
export function narrowLocations(
  current: AllowedLocations | undefined,
  granted: AllowedLocations,
): AllowedLocations {
  if (current === undefined) return [];
  if (current === "ALL") return granted;
  if (granted === "ALL") return current;
  return current.filter((locationId) => granted.includes(locationId));
}
