import type { ResourceResponse, ResourceTimeOffResponse } from "@banijjik/contracts/booking";
import type {
  ResourceCreateBody,
  ResourceTimeOffCreateBody,
  ResourceUpdateBody,
} from "@banijjik/validation/booking";
import { apiFetch } from "../lib/api/api-client";

function resourcesPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/resources${suffix}`;
}

export async function createResource(
  organizationId: string,
  body: ResourceCreateBody,
): Promise<ResourceResponse> {
  const result = await apiFetch<ResourceResponse>(resourcesPath(organizationId), {
    method: "POST",
    body,
  });
  return result.data;
}

export async function updateResource(
  organizationId: string,
  resourceId: string,
  body: ResourceUpdateBody,
): Promise<ResourceResponse> {
  const result = await apiFetch<ResourceResponse>(resourcesPath(organizationId, `/${resourceId}`), {
    method: "PATCH",
    body,
  });
  return result.data;
}

export async function archiveResource(
  organizationId: string,
  resourceId: string,
  version: number,
): Promise<ResourceResponse> {
  const result = await apiFetch<ResourceResponse>(
    resourcesPath(organizationId, `/${resourceId}/archive`),
    { method: "POST", body: { version } },
  );
  return result.data;
}

export async function createResourceTimeOff(
  organizationId: string,
  resourceId: string,
  body: ResourceTimeOffCreateBody,
): Promise<ResourceTimeOffResponse> {
  const result = await apiFetch<ResourceTimeOffResponse>(
    resourcesPath(organizationId, `/${resourceId}/time-off`),
    { method: "POST", body },
  );
  return result.data;
}
