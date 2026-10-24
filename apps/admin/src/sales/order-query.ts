import { ORDER_STATUS, type OrderStatus } from "@banijjik/contracts/sales";

type RawParam = string | string[] | undefined;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const STATUSES: readonly string[] = Object.values(ORDER_STATUS);

export const ORDERS_PAGE_SIZE = 20;

export interface OrdersQuery {
  readonly locationId: string | undefined;
  readonly status: OrderStatus | undefined;
  readonly q: string | undefined;
  readonly page: number;
}

function firstOf(value: RawParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function idOf(value: string | undefined): string | undefined {
  return value !== undefined && UUID_PATTERN.test(value) ? value : undefined;
}

function statusOf(value: string | undefined): OrderStatus | undefined {
  return value !== undefined && STATUSES.includes(value) ? (value as OrderStatus) : undefined;
}

function pageOf(value: string | undefined): number {
  if (value === undefined || !/^\d+$/u.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function termOf(value: string | undefined): string | undefined {
  const term = value?.trim();
  return term === undefined || term === "" ? undefined : term;
}

/** The list query of the URL: one status, one location, one page and one search term. */
export function parseOrdersQuery(params: Record<string, RawParam>): OrdersQuery {
  return {
    locationId: idOf(firstOf(params["location"])),
    status: statusOf(firstOf(params["status"])),
    q: termOf(firstOf(params["q"])),
    page: pageOf(firstOf(params["page"])),
  };
}

function toSearchParams(query: OrdersQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.locationId) params.set("location", query.locationId);
  if (query.status) params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export function ordersHref(basePath: string, query: OrdersQuery): string {
  const text = toSearchParams(query).toString();
  return text === "" ? basePath : `${basePath}?${text}`;
}

/** The query the API sees: the filters plus the page size this screen uses. */
export function ordersApiQuery(query: OrdersQuery): string {
  const params = new URLSearchParams();
  if (query.locationId) params.set("locationId", query.locationId);
  if (query.status) params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  params.set("page", String(query.page));
  params.set("limit", String(ORDERS_PAGE_SIZE));
  return params.toString();
}

/** A status chip keeps the location and the search term; the page starts again at one. */
export function statusHref(
  basePath: string,
  query: OrdersQuery,
  status: OrderStatus | undefined,
): string {
  return ordersHref(basePath, { ...query, status, page: 1 });
}
