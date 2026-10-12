import type { Member } from "../domain/member.entity.js";
import { firstAssignmentOutsideReach, isWithinReach, type Reach } from "../domain/reach.js";
import type { Assignment } from "../domain/member.entity.js";
import { recordNotFound, roleNotGrantable } from "../domain/errors.js";

/**
 * A member outside the caller's reach looks like no member at all (404, ADR-080): the answer must
 * not reveal that someone exists at a location the caller does not manage.
 */
export function requireMemberInReach(member: Member | undefined, reach: Reach): Member {
  if (member === undefined || !isWithinReach(member.assignments, reach)) throw recordNotFound();
  return member;
}

/**
 * A caller may only hand out locations inside their own reach: a manager of one location cannot
 * give "ALL" or another location, even for a role whose keys they hold everywhere. The key rule of
 * ADR-092 still applies on top (422, the same answer as for a role above the caller).
 */
export function assertAssignmentsInReach(assignments: readonly Assignment[], reach: Reach): void {
  const outside = firstAssignmentOutsideReach(assignments, reach);
  if (outside !== undefined) throw roleNotGrantable(outside.roleId);
}
