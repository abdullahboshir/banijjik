import { ENROLLMENT_STATUS, type EnrollmentStatus } from "@banijjik/contracts/enrollment";

export const ENROLLMENT_PAGE_LIMIT = 25;

const STATUSES = new Set<string>(Object.values(ENROLLMENT_STATUS));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type SearchParams = Record<string, string | string[] | undefined>;

export interface EnrollmentsQuery {
  readonly page: number;
  readonly limit: number;
  readonly status?: EnrollmentStatus | undefined;
  readonly offeringId?: string | undefined;
  readonly overdue: boolean;
}

function firstString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pageOf(searchParams: SearchParams): number {
  const page = Number(firstString(searchParams["page"]) ?? "1");
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function statusOf(searchParams: SearchParams): EnrollmentStatus | undefined {
  const raw = firstString(searchParams["status"]);
  return raw !== undefined && STATUSES.has(raw) ? (raw as EnrollmentStatus) : undefined;
}

function offeringIdOf(searchParams: SearchParams): string | undefined {
  const raw = firstString(searchParams["offeringId"]);
  return raw !== undefined && UUID_PATTERN.test(raw) ? raw : undefined;
}

/** Reads the list filters from the address; anything unknown is ignored, never sent to the API. */
export function parseEnrollmentsQuery(searchParams: SearchParams): EnrollmentsQuery {
  return {
    page: pageOf(searchParams),
    limit: ENROLLMENT_PAGE_LIMIT,
    status: statusOf(searchParams),
    offeringId: offeringIdOf(searchParams),
    overdue: firstString(searchParams["overdue"]) === "true",
  };
}

/** The filters as a query string; the same text serves the API call and the page links. */
export function enrollmentsQueryString(query: EnrollmentsQuery): string {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.status) params.set("status", query.status);
  if (query.offeringId) params.set("offeringId", query.offeringId);
  if (query.overdue) params.set("overdue", "true");
  return params.toString();
}
