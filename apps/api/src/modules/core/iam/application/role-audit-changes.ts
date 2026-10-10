import type { AuditChanges, AuditValue } from "@banijjik/contracts";
import type { Role } from "../domain/role.entity.js";

function sameKeys(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((key, index) => key === second[index]);
}

/** Only the fields an update really changed, as `{ from, to }`; keys are compared in sorted order. */
export function diffRoleChanges(before: Role, after: Role): AuditChanges {
  const changes: Record<string, { from: AuditValue; to: AuditValue }> = {};
  if (before.name !== after.name) changes["name"] = { from: before.name, to: after.name };
  const beforeKeys = [...before.permissionKeys].sort();
  const afterKeys = [...after.permissionKeys].sort();
  if (!sameKeys(beforeKeys, afterKeys)) {
    changes["permissionKeys"] = { from: beforeKeys, to: afterKeys };
  }
  return changes;
}
