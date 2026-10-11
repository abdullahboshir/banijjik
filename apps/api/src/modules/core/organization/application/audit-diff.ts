import type { Assignment } from "../domain/member.entity.js";

/** Assignments as sorted `locationId:roleId` strings, the audit form of the list. */
export function assignmentsAuditValue(assignments: readonly Assignment[]): readonly string[] {
  return assignments.map(({ locationId, roleId }) => `${locationId}:${roleId}`).sort();
}
