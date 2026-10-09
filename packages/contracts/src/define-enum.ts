/** Builds the constant pattern from a readonly tuple: ["A", "B"] becomes { A: "A", B: "B" }. */
export function defineEnum<const Values extends readonly string[]>(
  values: Values,
): { readonly [Key in Values[number]]: Key } {
  const entries = values.map((value) => [value, value] as const);
  // Safe: every key maps to itself, which is exactly the mapped type above.
  return Object.freeze(Object.fromEntries(entries)) as { readonly [Key in Values[number]]: Key };
}
