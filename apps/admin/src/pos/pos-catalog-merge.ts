import type { PosCatalogRemovedRow, PosCatalogRow } from "@banijjik/contracts/pos";

function keyOf(row: { readonly offeringId: string; readonly variantId: string }): string {
  return `${row.offeringId}:${row.variantId}`;
}

/**
 * Applies one incremental snapshot to the cached rows. A changed row replaces the cached one, and a
 * removed variant leaves the cache (it is no longer sellable at this location).
 */
export function mergeCatalogRows(
  cached: readonly PosCatalogRow[],
  changed: readonly PosCatalogRow[],
  removed: readonly PosCatalogRemovedRow[],
): PosCatalogRow[] {
  const byKey = new Map<string, PosCatalogRow>();
  for (const row of cached) byKey.set(keyOf(row), row);
  for (const row of changed) byKey.set(keyOf(row), row);
  for (const row of removed) byKey.delete(keyOf(row));
  return [...byKey.values()];
}
