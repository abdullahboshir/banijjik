import type { LocationResponse } from "@banijjik/contracts";
import type { LocationCreateBody, LocationUpdateBody } from "@banijjik/validation";
import { apiFetch } from "../lib/api/api-client";

/** `POST /orgs/{organizationId}/locations`; the same key on a retry gives the same location. */
export async function createLocation(
  organizationId: string,
  body: LocationCreateBody,
  idempotencyKey: string,
): Promise<LocationResponse> {
  const result = await apiFetch<LocationResponse>(`/orgs/${organizationId}/locations`, {
    method: "POST",
    body,
    idempotencyKey,
  });
  return result.data;
}

export async function updateLocation(
  organizationId: string,
  locationId: string,
  body: LocationUpdateBody,
): Promise<LocationResponse> {
  const result = await apiFetch<LocationResponse>(
    `/orgs/${organizationId}/locations/${locationId}`,
    { method: "PATCH", body },
  );
  return result.data;
}

export async function archiveLocation(
  organizationId: string,
  locationId: string,
  version: number,
): Promise<LocationResponse> {
  const result = await apiFetch<LocationResponse>(
    `/orgs/${organizationId}/locations/${locationId}/archive`,
    { method: "POST", body: { version } },
  );
  return result.data;
}
