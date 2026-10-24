import type { CommissionRuleStatus } from "@banijjik/contracts/commission";

export const COMMISSION_PAGE_SIZE = 20;
/** The summary cards name every member with commission; one page is enough for a small business. */
const COMMISSION_SUMMARY_LIMIT = 100;

type RawParam = string | string[] | undefined;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SUBJECT = /^(member|role):([0-9a-f-]{36})$/u;

function firstOf(value: RawParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function dateOf(value: string | undefined): string | undefined {
  return value !== undefined && ISO_DATE.test(value) ? value : undefined;
}

function idOf(value: string | undefined): string | undefined {
  return value !== undefined && UUID.test(value) ? value : undefined;
}

function pageOf(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

function isRuleStatus(value: string | undefined): value is CommissionRuleStatus {
  return value === "ACTIVE" || value === "ARCHIVED";
}

/** One "Who" choice of the rules filter: a member or a role. */
export interface CommissionSubjectFilter {
  memberId: string | undefined;
  roleId: string | undefined;
}

function subjectOf(value: string | undefined): CommissionSubjectFilter {
  const match = SUBJECT.exec(value ?? "");
  if (match === null) return { memberId: undefined, roleId: undefined };
  const id = idOf(match[2]);
  if (id === undefined) return { memberId: undefined, roleId: undefined };
  return match[1] === "member"
    ? { memberId: id, roleId: undefined }
    : { memberId: undefined, roleId: id };
}

function subjectParamOf(query: CommissionRuleQuery): string | undefined {
  if (query.memberId !== undefined) return `member:${query.memberId}`;
  if (query.roleId !== undefined) return `role:${query.roleId}`;
  return undefined;
}

export interface CommissionRuleQuery {
  memberId: string | undefined;
  roleId: string | undefined;
  status: CommissionRuleStatus | undefined;
  page: number;
}

/** The rules list state lives in the URL; unreadable values are ignored (13-UX section 3). */
export function parseCommissionRuleQuery(params: Record<string, RawParam>): CommissionRuleQuery {
  const status = firstOf(params["status"]);
  return {
    ...subjectOf(firstOf(params["subject"])),
    status: isRuleStatus(status) ? status : undefined,
    page: pageOf(firstOf(params["page"])),
  };
}

export function commissionRuleListHref(basePath: string, query: CommissionRuleQuery): string {
  const params = new URLSearchParams();
  const subject = subjectParamOf(query);
  if (subject !== undefined) params.set("subject", subject);
  if (query.status !== undefined) params.set("status", query.status);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text === "" ? basePath : `${basePath}?${text}`;
}

export function commissionRulesApiPath(organizationId: string, query: CommissionRuleQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(COMMISSION_PAGE_SIZE),
  });
  if (query.memberId !== undefined) params.set("memberId", query.memberId);
  if (query.roleId !== undefined) params.set("roleId", query.roleId);
  if (query.status !== undefined) params.set("status", query.status);
  return `/orgs/${organizationId}/commission/rules?${params.toString()}`;
}

export interface CommissionEntryQuery {
  memberId: string | undefined;
  locationId: string | undefined;
  from: string | undefined;
  to: string | undefined;
  page: number;
}

export function parseCommissionEntryQuery(params: Record<string, RawParam>): CommissionEntryQuery {
  return {
    memberId: idOf(firstOf(params["memberId"])),
    locationId: idOf(firstOf(params["locationId"])),
    from: dateOf(firstOf(params["from"])),
    to: dateOf(firstOf(params["to"])),
    page: pageOf(firstOf(params["page"])),
  };
}

/** "My commission" has dates only: the API always scopes it to the caller's own member. */
export function parseCommissionMyEntriesQuery(
  params: Record<string, RawParam>,
): CommissionEntryQuery {
  const parsed = parseCommissionEntryQuery(params);
  return { ...parsed, memberId: undefined, locationId: undefined };
}

export function commissionEntryListHref(basePath: string, query: CommissionEntryQuery): string {
  const params = new URLSearchParams();
  if (query.memberId !== undefined) params.set("memberId", query.memberId);
  if (query.locationId !== undefined) params.set("locationId", query.locationId);
  if (query.from !== undefined) params.set("from", query.from);
  if (query.to !== undefined) params.set("to", query.to);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text === "" ? basePath : `${basePath}?${text}`;
}

export function commissionEntriesApiPath(
  organizationId: string,
  query: CommissionEntryQuery,
  resource: "entries" | "my-entries" = "entries",
): string {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(COMMISSION_PAGE_SIZE),
  });
  if (resource === "entries") {
    if (query.memberId !== undefined) params.set("memberId", query.memberId);
    if (query.locationId !== undefined) params.set("location", query.locationId);
  }
  if (query.from !== undefined) params.set("from", query.from);
  if (query.to !== undefined) params.set("to", query.to);
  return `/orgs/${organizationId}/commission/${resource}?${params.toString()}`;
}

/** The per-member open and paid totals; only the location filter applies (13-UX summary cards). */
export function commissionSummaryApiPath(
  organizationId: string,
  query: CommissionEntryQuery,
): string {
  const params = new URLSearchParams({ page: "1", limit: String(COMMISSION_SUMMARY_LIMIT) });
  if (query.locationId !== undefined) params.set("location", query.locationId);
  return `/orgs/${organizationId}/commission/summary?${params.toString()}`;
}

export interface CommissionPayoutQuery {
  memberId: string | undefined;
  locationId: string | undefined;
  page: number;
}

export function parseCommissionPayoutQuery(
  params: Record<string, RawParam>,
): CommissionPayoutQuery {
  return {
    memberId: idOf(firstOf(params["memberId"])),
    locationId: idOf(firstOf(params["locationId"])),
    page: pageOf(firstOf(params["page"])),
  };
}

export function commissionPayoutListHref(basePath: string, query: CommissionPayoutQuery): string {
  const params = new URLSearchParams();
  if (query.memberId !== undefined) params.set("memberId", query.memberId);
  if (query.locationId !== undefined) params.set("locationId", query.locationId);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text === "" ? basePath : `${basePath}?${text}`;
}

export function commissionPayoutsApiPath(
  organizationId: string,
  query: CommissionPayoutQuery,
): string {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(COMMISSION_PAGE_SIZE),
  });
  if (query.memberId !== undefined) params.set("memberId", query.memberId);
  if (query.locationId !== undefined) params.set("location", query.locationId);
  return `/orgs/${organizationId}/commission/payouts?${params.toString()}`;
}
