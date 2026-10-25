/** The filters of the returns list, read from the URL so the list stays shareable (plan 3.5b card B). */
export interface ReturnsQuery {
  readonly page: number;
  readonly orderId?: string;
  readonly from?: string;
  readonly to?: string;
}

const FIRST_PAGE = 1;
const LIST_LIMIT = 50;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstValueOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pageOf(raw: string | undefined): number {
  const page = Number(raw);
  return Number.isInteger(page) && page >= FIRST_PAGE ? page : FIRST_PAGE;
}

function optionalMatch(raw: string | undefined, pattern: RegExp): string | undefined {
  return raw !== undefined && pattern.test(raw) ? raw : undefined;
}

/** Bad values from the URL are dropped, not sent: the API would refuse them with a validation error. */
export function parseReturnsQuery(
  searchParams: Record<string, string | string[] | undefined>,
): ReturnsQuery {
  const orderId = optionalMatch(firstValueOf(searchParams["orderId"]), UUID_V7);
  const from = optionalMatch(firstValueOf(searchParams["from"]), ISO_DATE);
  const to = optionalMatch(firstValueOf(searchParams["to"]), ISO_DATE);
  return {
    page: pageOf(firstValueOf(searchParams["page"])),
    ...(orderId === undefined ? {} : { orderId }),
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  };
}

/** The query string the API list reads (`page`, `limit` and the filters). */
export function returnsApiQuery(query: ReturnsQuery): string {
  const params = new URLSearchParams({ page: String(query.page), limit: String(LIST_LIMIT) });
  if (query.orderId !== undefined) params.set("orderId", query.orderId);
  if (query.from !== undefined) params.set("from", query.from);
  if (query.to !== undefined) params.set("to", query.to);
  return params.toString();
}

/** A link to another page of the same filtered list. */
export function returnsHref(basePath: string, query: ReturnsQuery): string {
  const params = new URLSearchParams();
  if (query.orderId !== undefined) params.set("orderId", query.orderId);
  if (query.from !== undefined) params.set("from", query.from);
  if (query.to !== undefined) params.set("to", query.to);
  if (query.page > FIRST_PAGE) params.set("page", String(query.page));
  const search = params.toString();
  return search === "" ? basePath : `${basePath}?${search}`;
}
