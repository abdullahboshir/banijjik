/**
 * An edit of an optional field (14-API.md section 5.1): a value sets it, `null` clears it, and an
 * absent key (or `undefined`) leaves it unchanged.
 */
export type ClearableChange<Value> = Value | null | undefined;

/** The edit of an optional field applied to the stored value; `undefined` means "no value". */
export function applyClearableChange<Value>(
  current: Value | undefined,
  change: ClearableChange<Value>,
): Value | undefined {
  if (change === null) return undefined;
  return change ?? current;
}

export type ClearableChanges<Fields> = {
  readonly [Key in keyof Fields]?: ClearableChange<NonNullable<Fields[Key]>>;
};

/**
 * The fields with the edits applied. A cleared field leaves the object (no key, not `undefined`),
 * so what is stored and returned never carries an empty marker.
 */
export function applyClearableChanges<Fields extends object>(
  current: Fields,
  changes: ClearableChanges<Fields>,
): Fields {
  const result: Record<string, unknown> = Object.fromEntries(Object.entries(current));
  for (const [key, change] of Object.entries(changes)) {
    if (change === undefined) continue;
    if (change === null) delete result[key];
    else result[key] = change;
  }
  // Safe: only keys of `changes` are touched and each carries a value of its field's type or is removed.
  return result as Fields;
}
