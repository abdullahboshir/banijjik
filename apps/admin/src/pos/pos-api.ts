import type { Money } from "@banijjik/contracts/payment";
import type {
  PosCatalogSnapshotResponse,
  PosSaleResponse,
  PosSessionResponse,
  PosZReport,
} from "@banijjik/contracts/pos";
import type { SalesPerformerResponse } from "@banijjik/contracts/sales";
import type { QuoteRequest, QuoteResponse } from "@banijjik/contracts/pricing";
import type { PosSaleBody, PosSessionCloseBody } from "@banijjik/validation/pos";
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

/** One page of the snapshot. `since` (the cached server time) asks for the changes only. */
export async function fetchCatalogPage(
  organizationId: string,
  page: { readonly cursor: string | null; readonly since: string | null },
): Promise<PosCatalogSnapshotResponse> {
  const query = new URLSearchParams();
  if (page.cursor) query.set("cursor", page.cursor);
  if (page.since) query.set("since", page.since);
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

/** The server prices the cart at the device location. The till never prices a line itself. */
export async function quoteCart(
  organizationId: string,
  body: QuoteRequest,
): Promise<QuoteResponse> {
  const result = await apiFetch<QuoteResponse>(`/orgs/${organizationId}/quotes`, {
    method: "POST",
    body,
  });
  return result.data;
}

/**
 * Counts the drawer and closes the register. The caller keeps one key per attempt, so a retry after a
 * lost answer replays the close instead of closing a second time (ADR-014).
 */
export async function closeSession(
  organizationId: string,
  posSessionId: string,
  request: { readonly body: PosSessionCloseBody; readonly idempotencyKey: string },
): Promise<PosSessionResponse> {
  const result = await apiFetch<PosSessionResponse>(
    `${posBase(organizationId)}/sessions/${posSessionId}/close`,
    { method: "POST", body: request.body, idempotencyKey: request.idempotencyKey },
  );
  return result.data;
}

/** Members who may be named on a walk-in service at this till's location. */
export async function listSalePerformers(
  organizationId: string,
  locationId: string,
): Promise<readonly SalesPerformerResponse[]> {
  const result = await apiFetch<SalesPerformerResponse[]>(
    `/orgs/${organizationId}/sales/performers?${new URLSearchParams({ locationId }).toString()}`,
  );
  return result.data;
}

/** The frozen Z-report of a closed register. */
export async function fetchZReport(
  organizationId: string,
  posSessionId: string,
): Promise<PosZReport> {
  const result = await apiFetch<PosZReport>(
    `${posBase(organizationId)}/sessions/${posSessionId}/z-report`,
  );
  return result.data;
}
