import type { PosCatalogRow } from "@banijjik/contracts/pos";
import { fetchCatalogPage } from "./pos-api";
import { mergeCatalogRows } from "./pos-catalog-merge";
import { catalogCacheKeyOf, readCachedCatalog, writeCachedCatalog } from "./pos-catalog-cache";

/**
 * The till's catalog for one location: the cached rows, brought up to date with the changes since
 * the cached snapshot (plan 3.9 decision 8). The sale is still quoted by the server; this list only
 * finds products and never sets a price.
 */
export async function syncCatalog(
  organizationId: string,
  locationId: string,
): Promise<PosCatalogRow[]> {
  const cacheKey = catalogCacheKeyOf(organizationId, locationId);
  const cached = await readCachedCatalog(cacheKey);
  let rows: PosCatalogRow[] = cached ? [...cached.rows] : [];
  const since = cached?.serverTime ?? null;
  let nextServerTime: string | null = null;
  let cursor: string | null = null;
  do {
    const page = await fetchCatalogPage(organizationId, { cursor, since });
    nextServerTime ??= page.serverTime;
    rows = mergeCatalogRows(rows, page.items, page.removed);
    cursor = page.nextCursor;
  } while (cursor !== null);
  if (nextServerTime !== null) {
    await writeCachedCatalog({ cacheKey, rows, serverTime: nextServerTime });
  }
  return rows;
}
