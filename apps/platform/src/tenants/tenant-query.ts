import { ORGANIZATION_STATUS, type OrganizationStatus } from "@banijjik/contracts";
import {
  LIST_PAGE_SIZE,
  choiceParam,
  hrefWith,
  pageParam,
  textParam,
  type RawParams,
} from "../lists/list-query";

export const TENANT_FILTER_STATUSES: readonly OrganizationStatus[] = [
  ORGANIZATION_STATUS.ACTIVE,
  ORGANIZATION_STATUS.SUSPENDED,
  ORGANIZATION_STATUS.CLOSED,
];

export interface TenantQuery {
  status: OrganizationStatus | undefined;
  q: string | undefined;
  page: number;
}

/** The list state lives in the URL (13-UX section 3). Anything unreadable is ignored, never an error. */
export function parseTenantQuery(params: RawParams): TenantQuery {
  return {
    status: choiceParam(params["status"], TENANT_FILTER_STATUSES),
    q: textParam(params["q"]),
    page: pageParam(params["page"]),
  };
}

export const TENANTS_PATH = "/tenants";

/** The list path with the given state; defaults (page 1, no filter) leave no trace in the URL. */
export function tenantListHref(query: TenantQuery): string {
  return hrefWith(TENANTS_PATH, {
    status: query.status,
    q: query.q,
    page: query.page > 1 ? query.page : undefined,
  });
}

/** The API path of one page of tenants. */
export function tenantsApiPath(query: TenantQuery): string {
  return hrefWith("/platform/organizations", {
    page: query.page,
    limit: LIST_PAGE_SIZE,
    status: query.status,
    q: query.q,
  });
}
