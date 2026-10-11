import type { OrganizationProfileResponse } from "@banijjik/contracts";
import type { ProfileUpdateBody } from "@banijjik/validation";
import { apiFetch } from "../lib/api/api-client";

/** `PATCH /orgs/{organizationId}/profile`: the answer is the saved profile with its new version. */
export async function updateProfile(
  organizationId: string,
  body: ProfileUpdateBody,
): Promise<OrganizationProfileResponse> {
  const result = await apiFetch<OrganizationProfileResponse>(`/orgs/${organizationId}/profile`, {
    method: "PATCH",
    body,
  });
  return result.data;
}
