"use client";

import type { PosCatalogRow } from "@banijjik/contracts/pos";
import { useEffect } from "react";
import { syncCatalog } from "./pos-catalog-sync";

/** The till asks for changes every five minutes while a register is open (plan 3.9 decision 8). */
export const CATALOG_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export interface OpenRegisterRef {
  readonly posSessionId: string;
  readonly locationId: string;
}

async function refreshRows(
  organizationId: string,
  register: OpenRegisterRef,
  onRows: (posSessionId: string, rows: readonly PosCatalogRow[]) => void,
): Promise<void> {
  let rows: PosCatalogRow[];
  try {
    rows = await syncCatalog(organizationId, register.locationId);
  } catch {
    // The rows on screen stay usable; the next tick tries again.
    return;
  }
  onRows(register.posSessionId, rows);
}

/** Refreshes the open register's catalog on a timer. Stops when the register is no longer on screen. */
export function useCatalogRefresh(
  organizationId: string,
  register: OpenRegisterRef | null,
  onRows: (posSessionId: string, rows: readonly PosCatalogRow[]) => void,
): void {
  const posSessionId = register?.posSessionId ?? null;
  const locationId = register?.locationId ?? null;
  useEffect(() => {
    if (posSessionId === null || locationId === null) return;
    const register = { posSessionId, locationId };
    const timer = window.setInterval(
      () => void refreshRows(organizationId, register, onRows),
      CATALOG_REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [organizationId, posSessionId, locationId, onRows]);
}
