/** The keys that are in exactly one of the two lists: what a role edit adds plus what it removes. */
export function changedPermissionKeys(
  before: readonly string[],
  after: readonly string[],
): readonly string[] {
  const kept = new Set(before);
  const next = new Set(after);
  const added = after.filter((key) => !kept.has(key));
  const removed = before.filter((key) => !next.has(key));
  return [...new Set([...added, ...removed])];
}

/**
 * The keys the caller may not hand out: a role is an organization-level record, so a key counts
 * only when the caller holds it at every location (ADR-092). Sorted, so the answer is stable.
 */
export function keysNotHeld(
  keys: readonly string[],
  heldAtAllLocations: readonly string[],
): readonly string[] {
  const held = new Set(heldAtAllLocations);
  return keys.filter((key) => !held.has(key)).sort();
}
