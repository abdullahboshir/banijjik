import type { AuditChanges, AuditValue } from "@banijjik/contracts";

export type AuditFields = Readonly<Record<string, AuditValue | undefined>>;

function sameValue(left: AuditValue | undefined, right: AuditValue | undefined): boolean {
  if (Array.isArray(left) && Array.isArray(right)) return left.join("|") === right.join("|");
  return left === right;
}

function toEntry(from: AuditValue | undefined, to: AuditValue | undefined): { to?: AuditValue } {
  if (to !== undefined) return { to };
  if (from !== undefined) return { to: null };
  return {};
}

/**
 * Per field that differs: the value before and after. Fields equal or unset on both sides are left
 * out. A field that had a value and has none now is recorded as `to: null`: the entry shows it was
 * emptied, not that nothing was written.
 */
export function diffAuditFields(before: AuditFields, after: AuditFields): AuditChanges {
  const changes: Record<string, { from?: AuditValue; to?: AuditValue }> = {};
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const from = before[field];
    const to = after[field];
    if (sameValue(from, to)) continue;
    changes[field] = {
      ...(from === undefined ? {} : { from }),
      ...toEntry(from, to),
    };
  }
  return changes;
}
