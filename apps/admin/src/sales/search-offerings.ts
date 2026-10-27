import { OFFERING_KIND, type OfferingKind } from "@banijjik/contracts";
import type { OfferingListItem } from "@banijjik/contracts/catalog";

/** Instant sales search products and services; draft and placed orders stay product-only (plan 3.40). */
export function offeringSearchKinds(includeServices: boolean): readonly OfferingKind[] {
  if (includeServices) return [OFFERING_KIND.PRODUCT, OFFERING_KIND.SERVICE];
  return [OFFERING_KIND.PRODUCT];
}

/** One list, unique by offering, sorted by name so two parallel kind requests read as one picker. */
export function mergeOfferingSearchByName(
  groups: readonly (readonly OfferingListItem[])[],
): OfferingListItem[] {
  const seen = new Set<string>();
  const items: OfferingListItem[] = [];
  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.offeringId)) continue;
      seen.add(item.offeringId);
      items.push(item);
    }
  }
  return items.sort((left, right) => left.name.localeCompare(right.name));
}
