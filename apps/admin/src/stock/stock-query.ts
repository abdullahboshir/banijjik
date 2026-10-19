export const STOCK_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 80;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

type RawParam = string | string[] | undefined;

export interface StockQuery {
  locationId: string | undefined;
  q: string | undefined;
  lowOnly: boolean;
  page: number;
}

function firstOf(value: RawParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function idOf(value: string | undefined): string | undefined {
  return value !== undefined && UUID_PATTERN.test(value) ? value : undefined;
}

/** Stock list filters live in the URL; bad values are ignored. */
export function parseStockQuery(params: Record<string, RawParam>): StockQuery {
  const search = firstOf(params["q"])?.trim().slice(0, MAX_SEARCH_LENGTH);
  const page = Number(firstOf(params["page"]));
  return {
    locationId: idOf(firstOf(params["location"])),
    q: search ? search : undefined,
    lowOnly: firstOf(params["lowOnly"]) === "true",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

function toSearchParams(query: StockQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.locationId) params.set("location", query.locationId);
  if (query.q) params.set("q", query.q);
  if (query.lowOnly) params.set("lowOnly", "true");
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export function stockListHref(basePath: string, query: StockQuery): string {
  const params = toSearchParams(query);
  const suffix = params.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}

export function stockLevelsApiPath(
  organizationId: string,
  query: StockQuery,
  locationId: string,
): string {
  const params = new URLSearchParams({
    locationId,
    page: String(query.page),
    limit: String(STOCK_PAGE_SIZE),
  });
  if (query.q) params.set("q", query.q);
  if (query.lowOnly) params.set("lowOnly", "true");
  return `/orgs/${organizationId}/stock/levels?${params.toString()}`;
}

export function stockMovementsApiPath(
  organizationId: string,
  filters: {
    inventoryItemId?: string;
    locationId?: string;
    page?: number;
    limit?: number;
  },
): string {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    limit: String(filters.limit ?? STOCK_PAGE_SIZE),
  });
  if (filters.inventoryItemId) params.set("inventoryItemId", filters.inventoryItemId);
  if (filters.locationId) params.set("locationId", filters.locationId);
  return `/orgs/${organizationId}/stock/movements?${params.toString()}`;
}
