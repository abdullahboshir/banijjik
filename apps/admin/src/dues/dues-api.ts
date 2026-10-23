import type { ApiResult } from "../lib/api/parse-api-response";
import type { DueItemResponse } from "@banijjik/contracts/payment";
import { fetchBusinessResource } from "../lib/api/server-resource";

export interface DuesQuery {
  page: number;
  contactId?: string | undefined;
  requestType?: string | undefined;
}

export const DUES_PAGE_LIMIT = 20;

export function duesSearch(query: DuesQuery): string {
  return new URLSearchParams({
    page: String(query.page),
    limit: String(DUES_PAGE_LIMIT),
    ...(query.contactId ? { contactId: query.contactId } : {}),
    ...(query.requestType ? { requestType: query.requestType } : {}),
  }).toString();
}

export function fetchDues(
  organizationId: string,
  query: DuesQuery,
): Promise<ApiResult<DueItemResponse[], { total: number }>> {
  return fetchBusinessResource<DueItemResponse[], { total: number }>(
    `/orgs/${organizationId}/dues?${duesSearch(query)}`,
  );
}
