import { CREDIT_PURCHASE_STATUS, type CreditPurchaseStatus } from "@banijjik/contracts/credit";

/** The status filter value that lifts the default (the queue shows waiting purchases first). */
export const ALL_STATUSES = "ALL";

const PURCHASE_PAGE_LIMIT = 50;
const STATUSES = new Set<string>(Object.values(CREDIT_PURCHASE_STATUS));

type SearchParams = Record<string, string | string[] | undefined>;

export interface CreditPurchasesQuery {
  /** `undefined` means every status. */
  status: CreditPurchaseStatus | undefined;
  q: string | undefined;
  page: number;
}

function firstString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function statusOf(searchParams: SearchParams): CreditPurchaseStatus | undefined {
  const raw = firstString(searchParams["status"]);
  if (raw === ALL_STATUSES) return undefined;
  if (raw === undefined || !STATUSES.has(raw)) return CREDIT_PURCHASE_STATUS.PENDING;
  return raw as CreditPurchaseStatus;
}

function pageOf(searchParams: SearchParams): number {
  const page = Number(firstString(searchParams["page"]) ?? "1");
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

export function parseCreditPurchasesQuery(searchParams: SearchParams): CreditPurchasesQuery {
  const q = firstString(searchParams["q"])?.trim();
  return {
    status: statusOf(searchParams),
    q: q === undefined || q.length === 0 ? undefined : q,
    page: pageOf(searchParams),
  };
}

export function creditPurchasesApiQuery(query: CreditPurchasesQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(PURCHASE_PAGE_LIMIT),
  });
  if (query.status !== undefined) params.set("status", query.status);
  if (query.q !== undefined) params.set("q", query.q);
  return params.toString();
}

export function creditPurchasesHasNext(query: CreditPurchasesQuery, total: number): boolean {
  return query.page * PURCHASE_PAGE_LIMIT < total;
}

/** A link that keeps the filters and changes the page; page 1 leaves `page` out. */
export function creditPurchasesHref(basePath: string, query: CreditPurchasesQuery): string {
  const params = new URLSearchParams();
  params.set("status", query.status ?? ALL_STATUSES);
  if (query.q !== undefined) params.set("q", query.q);
  if (query.page > 1) params.set("page", String(query.page));
  return `${basePath}?${params.toString()}`;
}
