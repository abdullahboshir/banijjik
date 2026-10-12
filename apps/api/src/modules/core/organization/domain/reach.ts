import type { Assignment } from "./member.entity.js";

/**
 * The locations where the caller holds one permission (the request's narrowed locations after
 * `permission(key)`): a list of location IDs, or "ALL" for every location.
 */
export type Reach = readonly string[] | "ALL";

/** The first assignment that names a location outside the reach, if there is one. */
export function firstAssignmentOutsideReach(
  assignments: readonly Assignment[],
  reach: Reach,
): Assignment | undefined {
  if (reach === "ALL") return undefined;
  return assignments.find(({ locationId }) => !reach.includes(locationId));
}

/**
 * The one reach rule of staff management (review M3), shared by members and invitations: a record
 * is in reach when every one of its assignments names a location inside the caller's reach. "ALL"
 * is not a location ID, so an assignment at "ALL" is inside the reach only of a caller whose reach
 * is "ALL". The Mongo form of this rule is `assignmentsReachFilter` (infrastructure); a persistence
 * test keeps the two equal. Reach is an extra condition on top of the permission and the key rule
 * of ADR-092, never a replacement for them.
 */
export function isWithinReach(assignments: readonly Assignment[], reach: Reach): boolean {
  return firstAssignmentOutsideReach(assignments, reach) === undefined;
}
