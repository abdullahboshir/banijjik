import type { MeResponse, MyOrganizationSummary } from "@banijjik/contracts";
import { apiFetch } from "./api-client";

/** TanStack Query key of the businesses the signed-in person belongs to. */
export const MY_ORGANIZATIONS_QUERY_KEY = ["me", "orgs"] as const;

export async function fetchMe(): Promise<MeResponse> {
  const result = await apiFetch<MeResponse>("/me");
  return result.data;
}

export async function fetchMyOrganizations(): Promise<MyOrganizationSummary[]> {
  const result = await apiFetch<MyOrganizationSummary[]>("/me/orgs");
  return result.data;
}
