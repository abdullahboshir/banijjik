import { MEMBER_STATUS, type MemberStatus } from "@banijjik/contracts";

export const STAFF_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 80;

export interface StaffQuery {
  status: MemberStatus | undefined;
  q: string | undefined;
  page: number;
}

type RawParam = string | string[] | undefined;

function firstOf(value: RawParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isMemberStatus(value: string | undefined): value is MemberStatus {
  // Safe: widening to string[] only lets `includes` accept an arbitrary string; nothing is written.
  return value !== undefined && (Object.values(MEMBER_STATUS) as string[]).includes(value);
}

/** The list state lives in the URL (13-UX section 3). Anything unreadable is ignored, never an error. */
export function parseStaffQuery(params: Record<string, RawParam>): StaffQuery {
  const status = firstOf(params["status"]);
  const search = firstOf(params["q"])?.trim().slice(0, MAX_SEARCH_LENGTH);
  const page = Number(firstOf(params["page"]));
  return {
    status: isMemberStatus(status) ? status : undefined,
    q: search ? search : undefined,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** The list path with the given state; defaults (page 1, no filter) leave no trace in the URL. */
export function staffListHref(basePath: string, query: StaffQuery): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text === "" ? basePath : `${basePath}?${text}`;
}

/** The API path of one page of members. */
export function membersApiPath(organizationId: string, query: StaffQuery): string {
  const params = new URLSearchParams({ page: String(query.page), limit: String(STAFF_PAGE_SIZE) });
  if (query.status) params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  return `/orgs/${organizationId}/members?${params.toString()}`;
}
