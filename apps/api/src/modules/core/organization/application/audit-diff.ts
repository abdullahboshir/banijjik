import type { AuditChanges, AuditValue } from "@banijjik/contracts";
import type { Assignment } from "../domain/member.entity.js";

export type AuditFields = Readonly<Record<string, AuditValue | undefined>>;

function sameValue(left: AuditValue | undefined, right: AuditValue | undefined): boolean {
  if (Array.isArray(left) && Array.isArray(right)) return left.join("|") === right.join("|");
  return left === right;
}

/** Per field that differs: the value before and after. Fields that are equal, or unset on both sides, are left out. */
export function diffAuditFields(before: AuditFields, after: AuditFields): AuditChanges {
  const changes: Record<string, { from?: AuditValue; to?: AuditValue }> = {};
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const from = before[field];
    const to = after[field];
    if (sameValue(from, to)) continue;
    changes[field] = {
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
    };
  }
  return changes;
}

/** Assignments as sorted `locationId:roleId` strings, the audit form of the list. */
export function assignmentsAuditValue(assignments: readonly Assignment[]): readonly string[] {
  return assignments.map(({ locationId, roleId }) => `${locationId}:${roleId}`).sort();
}
