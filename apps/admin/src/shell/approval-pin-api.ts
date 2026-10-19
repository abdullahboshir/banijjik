import { apiFetch } from "../lib/api/api-client";

/** `PUT /orgs/{organizationId}/me/approval-pin`. */
export async function setApprovalPin(
  organizationId: string,
  body: { currentPassword: string; pin: string },
): Promise<void> {
  await apiFetch(`/orgs/${organizationId}/me/approval-pin`, {
    method: "PUT",
    body,
  });
}

/** `DELETE /orgs/{organizationId}/me/approval-pin`. */
export async function removeApprovalPin(organizationId: string): Promise<void> {
  await apiFetch(`/orgs/${organizationId}/me/approval-pin`, {
    method: "DELETE",
  });
}
