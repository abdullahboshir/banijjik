import type { Reach } from "../domain/reach.js";

/**
 * The Mongo form of `isWithinReach` (domain/reach.ts), for list queries that must filter and page
 * in the database: only documents whose every assignment names a location inside the reach.
 * "ALL" is not a location ID, so an assignment at "ALL" never matches a reach that is a list of
 * locations. Members and invitations always carry at least one assignment.
 */
export function assignmentsReachFilter(reach: Reach): object {
  if (reach === "ALL") return {};
  return { assignments: { $not: { $elemMatch: { locationId: { $nin: [...reach] } } } } };
}
