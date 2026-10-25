import { ApiError } from "@banijjik/web-client";
import type { PosCatalogRow, PosSessionResponse } from "@banijjik/contracts/pos";
import { POS_API_MESSAGE_KEYS } from "@banijjik/contracts/pos";
import { fetchCatalogPage, getCurrentSession } from "./pos-api";

/** What the till shows first: pair the browser, open the register, or sell. */
export type PosStartPhase =
  | { readonly kind: "pairing" }
  | { readonly kind: "opening" }
  | {
      readonly kind: "selling";
      readonly session: PosSessionResponse;
      readonly rows: readonly PosCatalogRow[];
    };

/** The API answers an unpaired browser with this one key; every other failure is a real error. */
export function isDeviceRequiredError(error: unknown): boolean {
  return error instanceof ApiError && error.messageKey === POS_API_MESSAGE_KEYS.deviceRequired;
}

/** Reads every page of the catalog snapshot. The cache is built once per open till (plan decision 8). */
export async function loadAllCatalogRows(organizationId: string): Promise<PosCatalogRow[]> {
  const rows: PosCatalogRow[] = [];
  let cursor: string | null = null;
  do {
    const page = await fetchCatalogPage(organizationId, cursor);
    rows.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== null);
  return rows;
}

/** Decides the first screen. An unpaired browser is not an error: it gets the pairing form. */
export async function resolveStartPhase(organizationId: string): Promise<PosStartPhase> {
  let session: PosSessionResponse | null;
  try {
    session = await getCurrentSession(organizationId);
  } catch (error) {
    if (isDeviceRequiredError(error)) return { kind: "pairing" };
    throw error;
  }
  if (session === null) return { kind: "opening" };
  return { kind: "selling", session, rows: await loadAllCatalogRows(organizationId) };
}
