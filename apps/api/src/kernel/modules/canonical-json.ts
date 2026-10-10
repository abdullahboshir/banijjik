function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;
  const sortedEntries = Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, child]) => [key, sortKeys(child)] as const);
  return Object.fromEntries(sortedEntries);
}

/** JSON with object keys in a fixed order, so the same data always gives the same text (and hash). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
