import "server-only";
import type { LocationResponse } from "@banijjik/contracts";
import type { ReportDailyResponse, ReportHomeResponse } from "@banijjik/contracts/report";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import type { OrgAccess } from "../shell/org-access";
import { dailyReportPath, homeReportPath, type ReportRangeQuery } from "./report-query";

/** Active locations of the business, for the filter. A caller without the location read gets none. */
export async function loadReportLocations(access: OrgAccess): Promise<readonly LocationResponse[]> {
  const { organizationId } = access.organization;
  const locations = await fetchBusinessResourceIfAllowed<LocationResponse[]>(
    `/orgs/${organizationId}/locations?status=ACTIVE&limit=100`,
  );
  return locations ?? [];
}

/** The home read of the caller; undefined when the API refuses (for example a location the caller is not assigned to). */
export function loadHomeReport(
  access: OrgAccess,
  locationId: string | undefined,
): Promise<ReportHomeResponse | undefined> {
  return fetchBusinessResourceIfAllowed<ReportHomeResponse>(
    homeReportPath(access.organization.organizationId, locationId),
  );
}

/** The daily read for one range; the caller holds the permission (the page checked it). */
export async function loadDailyReport(
  access: OrgAccess,
  query: ReportRangeQuery,
): Promise<ReportDailyResponse> {
  const result = await fetchBusinessResource<ReportDailyResponse>(
    dailyReportPath(access.organization.organizationId, query),
  );
  return result.data;
}
