import type { RoleResponse } from "@banijjik/contracts";
import type { RoleCreateBody, RoleUpdateBody } from "@banijjik/validation";
import { apiFetch } from "../lib/api/api-client";

/** `POST /orgs/{organizationId}/roles`: a custom role. */
export async function createRole(
  organizationId: string,
  body: RoleCreateBody,
): Promise<RoleResponse> {
  const result = await apiFetch<RoleResponse>(`/orgs/${organizationId}/roles`, {
    method: "POST",
    body,
  });
  return result.data;
}

export async function updateRole(
  organizationId: string,
  roleId: string,
  body: RoleUpdateBody,
): Promise<RoleResponse> {
  const result = await apiFetch<RoleResponse>(`/orgs/${organizationId}/roles/${roleId}`, {
    method: "PATCH",
    body,
  });
  return result.data;
}

export async function archiveRole(
  organizationId: string,
  roleId: string,
  version: number,
): Promise<RoleResponse> {
  const result = await apiFetch<RoleResponse>(`/orgs/${organizationId}/roles/${roleId}/archive`, {
    method: "POST",
    body: { version },
  });
  return result.data;
}
