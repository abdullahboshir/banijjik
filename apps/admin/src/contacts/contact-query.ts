import { CONTACT_ROLE, type ContactRole } from "@banijjik/contracts";
import { CONTACT_STATUS, type ContactStatus } from "@banijjik/contracts/contact";

export const CONTACT_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 80;

export interface ContactQuery {
  role: ContactRole | undefined;
  /** ACTIVE unless the person asks for the archived ones. */
  status: ContactStatus;
  q: string | undefined;
  page: number;
}

type RawParam = string | string[] | undefined;

function firstOf(value: RawParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isRole(value: string | undefined): value is ContactRole {
  // Safe: widening to string[] only lets `includes` accept an arbitrary string; nothing is written.
  return value !== undefined && (Object.values(CONTACT_ROLE) as string[]).includes(value);
}

/** The list state lives in the URL (13-UX section 3). Anything unreadable is ignored, never an error. */
export function parseContactQuery(params: Record<string, RawParam>): ContactQuery {
  const role = firstOf(params["role"]);
  const search = firstOf(params["q"])?.trim().slice(0, MAX_SEARCH_LENGTH);
  const page = Number(firstOf(params["page"]));
  return {
    role: isRole(role) ? role : undefined,
    status: firstOf(params["status"]) === CONTACT_STATUS.ARCHIVED ? "ARCHIVED" : "ACTIVE",
    q: search ? search : undefined,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** The list path with the given state; defaults (page 1, no filter, active) leave no trace in the URL. */
export function contactListHref(basePath: string, query: ContactQuery): string {
  const params = new URLSearchParams();
  if (query.role) params.set("role", query.role);
  if (query.status === "ARCHIVED") params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text === "" ? basePath : `${basePath}?${text}`;
}

/** The API path of one page of contacts. */
export function contactsApiPath(organizationId: string, query: ContactQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(CONTACT_PAGE_SIZE),
    status: query.status,
  });
  if (query.role) params.set("role", query.role);
  if (query.q) params.set("q", query.q);
  return `/orgs/${organizationId}/contacts?${params.toString()}`;
}
