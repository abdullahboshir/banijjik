import { ALL_LOCATIONS } from "@banijjik/contracts";

/** Who may do what where: the resolved permissions of one member (09 section 4.4). */
export interface GrantMap {
  /** Keys granted by a role assigned at "ALL" locations. */
  readonly allLocations: ReadonlySet<string>;
  /** Keys granted by roles assigned at one specific location. */
  readonly byLocation: ReadonlyMap<string, ReadonlySet<string>>;
}

export interface RoleAssignment {
  /** A location ID or "ALL". */
  readonly locationId: string;
  readonly roleId: string;
}

/**
 * Effective permissions at location L are the union of the roles assigned at L and at ALL. A role
 * that grants nothing (archived, removed) simply contributes an empty set.
 */
export function buildGrantMap(
  assignments: readonly RoleAssignment[],
  grantsOfRole: (roleId: string) => ReadonlySet<string>,
): GrantMap {
  const allLocations = new Set<string>();
  const byLocation = new Map<string, Set<string>>();
  for (const { locationId, roleId } of assignments) {
    const target = locationId === ALL_LOCATIONS ? allLocations : setFor(byLocation, locationId);
    for (const key of grantsOfRole(roleId)) target.add(key);
  }
  return { allLocations, byLocation };
}

function setFor(byLocation: Map<string, Set<string>>, locationId: string): Set<string> {
  const existing = byLocation.get(locationId);
  if (existing !== undefined) return existing;
  const created = new Set<string>();
  byLocation.set(locationId, created);
  return created;
}

/** "ALL" when the key is granted everywhere, otherwise the locations that grant it (maybe none). */
export function locationsGranting(
  grantMap: GrantMap,
  permissionKey: string,
): readonly string[] | "ALL" {
  if (grantMap.allLocations.has(permissionKey)) return ALL_LOCATIONS;
  const granting: string[] = [];
  for (const [locationId, keys] of grantMap.byLocation) {
    if (keys.has(permissionKey)) granting.push(locationId);
  }
  return granting;
}
