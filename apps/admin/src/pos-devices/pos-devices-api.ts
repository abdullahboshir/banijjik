import type { PosDeviceCreatedResponse, PosDeviceResponse } from "@banijjik/contracts/pos";
import type { PosDeviceCreateBody, PosDeviceRevokeBody } from "@banijjik/validation/pos";
import { apiFetch } from "../lib/api/api-client";

/**
 * Adds a till. The answer carries the one-time pairing code, shown once. No Idempotency-Key: the API
 * stores no answer for it, because a stored answer would keep the one-time code.
 */
export async function createPosDevice(
  organizationId: string,
  body: PosDeviceCreateBody,
): Promise<PosDeviceCreatedResponse> {
  const result = await apiFetch<PosDeviceCreatedResponse>(`/orgs/${organizationId}/pos/devices`, {
    method: "POST",
    body,
  });
  return result.data;
}

/** Revokes a till. `version` is the one the list was drawn from; a stale one is refused with 409. */
export async function revokePosDevice(
  organizationId: string,
  posDeviceId: string,
  body: PosDeviceRevokeBody,
): Promise<PosDeviceResponse> {
  const result = await apiFetch<PosDeviceResponse>(
    `/orgs/${organizationId}/pos/devices/${posDeviceId}/revoke`,
    { method: "POST", body },
  );
  return result.data;
}
