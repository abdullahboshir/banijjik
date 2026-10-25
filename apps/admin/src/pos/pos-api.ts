import type { Money } from "@banijjik/contracts/payment";
import type {
  PosCatalogSnapshotResponse,
  PosSaleResponse,
  PosSessionResponse,
} from "@banijjik/contracts/pos";
import type { PosSaleBody } from "@banijjik/validation/pos";
import { apiFetch } from "../lib/api/api-client";

function posBase(organizationId: string): string {
  return `/orgs/${organizationId}/pos`;
}

/** The open register of this till, or null. Refused with `pos_device_required` when the browser is not paired. */
export async function getCurrentSession(
  organizationId: string,
): Promise<PosSessionResponse | null> {
  const result = await apiFetch<PosSessionResponse | null>(
    `${posBase(organizationId)}/sessions/current`,
  );
  return result.data;
}

/** The browser receives the device cookie from this answer; the code is spent on success. */
export async function pairDevice(organizationId: string, pairingCode: string): Promise<void> {
  await apiFetch(`${posBase(organizationId)}/devices/pair`, {
    method: "POST",
    body: { pairingCode },
  });
}

/**
 * A new open register. The caller passes one key per attempt, so a retry after a lost answer
 * replays the first response instead of opening a second register.
 */
export async function openSession(
  organizationId: string,
  openingFloat: Money,
  idempotencyKey: string,
): Promise<PosSessionResponse> {
  const result = await apiFetch<PosSessionResponse>(`${posBase(organizationId)}/sessions`, {
    method: "POST",
    body: { openingFloat },
    idempotencyKey,
  });
  return result.data;
}

export async function fetchCatalogPage(
  organizationId: string,
  cursor: string | null,
): Promise<PosCatalogSnapshotResponse> {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const result = await apiFetch<PosCatalogSnapshotResponse>(
    `${posBase(organizationId)}/catalog-snapshot${suffix}`,
  );
  return result.data;
}

/**
 * The sale is quoted and charged by the server; the body carries no price the till decided. The
 * caller keeps one key for the whole checkout attempt (ADR-014): a retry never charges twice.
 */
export async function createSale(
  organizationId: string,
  body: PosSaleBody,
  idempotencyKey: string,
): Promise<PosSaleResponse> {
  const result = await apiFetch<PosSaleResponse>(`${posBase(organizationId)}/sales`, {
    method: "POST",
    body,
    idempotencyKey,
  });
  return result.data;
}
