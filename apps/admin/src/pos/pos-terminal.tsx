"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/payment";
import type { PosCatalogRow, PosSessionResponse } from "@banijjik/contracts/pos";
import { Button } from "@banijjik/ui";
import { newId } from "@banijjik/ids";
import { useEffect, useState, type ReactElement } from "react";
import { openSession, pairDevice } from "./pos-api";
import type { PosLabels } from "./pos-labels";
import { PosOpenRegisterForm } from "./pos-open-register-form";
import { PosPairingForm } from "./pos-pairing-form";
import { PosSaleScreen } from "./pos-sale-screen";
import { loadAllCatalogRows, resolveStartPhase, type PosStartPhase } from "./pos-start";

export interface PosTerminalProps {
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly labels: PosLabels;
}

/** The device cookie only reaches the API, so the first screen is decided in the browser. */
type TerminalView = PosStartPhase | { readonly kind: "loading" } | { readonly kind: "failed" };

export function PosTerminal(props: PosTerminalProps): ReactElement {
  const { organizationId, currency, labels } = props;
  const [view, setView] = useState<TerminalView>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadStartPhase(): Promise<void> {
      try {
        const phase = await resolveStartPhase(organizationId);
        if (!cancelled) setView(phase);
      } catch {
        if (!cancelled) setView({ kind: "failed" });
      }
    }
    void loadStartPhase();
    return () => {
      cancelled = true;
    };
  }, [organizationId, attempt]);

  async function handlePair(pairingCode: string): Promise<void> {
    await pairDevice(organizationId, pairingCode);
    setView(await resolveStartPhase(organizationId));
  }

  async function handleOpen(openingFloat: Money): Promise<void> {
    // One key per click: the register form is disabled while the request runs (ADR-014).
    const session: PosSessionResponse = await openSession(organizationId, openingFloat, newId());
    const rows: readonly PosCatalogRow[] = await loadAllCatalogRows(organizationId);
    setView({ kind: "selling", session, rows });
  }

  if (view.kind === "loading") {
    return <p className="p-4 text-body text-secondary">{labels.loading}</p>;
  }
  if (view.kind === "failed") {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p role="alert" className="text-body text-danger">
          {labels.loadFailed}
        </p>
        <Button className="min-h-14" onClick={() => setAttempt((count) => count + 1)}>
          {labels.retry}
        </Button>
      </div>
    );
  }
  if (view.kind === "pairing") {
    return <PosPairingForm labels={labels} onPair={handlePair} />;
  }
  if (view.kind === "opening") {
    return (
      <PosOpenRegisterForm
        labels={labels}
        currency={currency}
        failureText={labels.loadFailed}
        onOpen={handleOpen}
      />
    );
  }
  return <PosSaleScreen labels={labels} rows={view.rows} />;
}
