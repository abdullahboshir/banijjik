import type { PosCatalogRow } from "@banijjik/contracts/pos";

/** Enough results for a phone screen; a longer list is a search for the cashier to narrow. */
export const CATALOG_SEARCH_RESULT_LIMIT = 40;

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/** A scanned barcode or SKU matches exactly; a typed word matches a name, a variant or a code. */
function rowMatches(row: PosCatalogRow, needle: string): boolean {
  const exactCodes = [row.barcode, row.sku].filter((code): code is string => code !== null);
  if (exactCodes.some((code) => normalize(code) === needle)) return true;
  return [row.offeringName, row.variantName].some((name) => normalize(name).includes(needle));
}

/** Filters the cached rows locally. Prices are not read here; the sale is quoted by the server. */
export function searchCatalog(
  rows: readonly PosCatalogRow[],
  query: string,
): readonly PosCatalogRow[] {
  const needle = normalize(query);
  if (needle.length === 0) return [];
  return rows.filter((row) => rowMatches(row, needle)).slice(0, CATALOG_SEARCH_RESULT_LIMIT);
}
