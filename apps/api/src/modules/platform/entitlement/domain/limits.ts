import {
  LIMIT_KEY_VALUES,
  type LimitKey,
  type LimitMap,
  type LimitValue,
} from "@banijjik/contracts";

/** The slice of a package that decides limits. */
export interface LimitSource {
  readonly limits: LimitMap;
  readonly limitIncrements: Readonly<Partial<Record<LimitKey, number>>>;
}

function sumIncrements(addOns: readonly LimitSource[], limitKey: LimitKey): number {
  return addOns.reduce((total, addOn) => total + (addOn.limitIncrements[limitKey] ?? 0), 0);
}

function limitValue(
  base: LimitSource | undefined,
  addOns: readonly LimitSource[],
  limitKey: LimitKey,
): LimitValue {
  // No base package means nothing was bought: the counted things are 0, add-ons alone buy no capacity.
  if (base === undefined) return 0;
  const baseValue = base.limits[limitKey];
  // null is unlimited and wins over any increment (10-MODULE-CATALOG section 3, step 6).
  if (baseValue === null) return null;
  return baseValue + sumIncrements(addOns, limitKey);
}

/** Step 6: limits = base limits + the sum of the add-on increments; `null` (unlimited) wins. */
export function combineLimits(
  base: LimitSource | undefined,
  addOns: readonly LimitSource[],
): LimitMap {
  const entries = LIMIT_KEY_VALUES.map((limitKey) => [
    limitKey,
    limitValue(base, addOns, limitKey),
  ]);
  // Safe: every LimitKey is present, which is exactly the LimitMap shape.
  return Object.fromEntries(entries) as LimitMap;
}
