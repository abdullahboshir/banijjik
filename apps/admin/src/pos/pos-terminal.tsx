"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/payment";
import type { PosCatalogRow, PosSessionResponse } from "@banijjik/contracts/pos";
import { Button, type DisplayLocale } from "@banijjik/ui";
import { newId } from "@banijjik/ids";
import { useEffect, useState, type ReactElement } from "react";
import { openSession, pairDevice } from "./pos-api";
import type { PosLabels } from "./pos-labels";
import { PosCloseLazy } from "./pos-close-lazy";
import { PosOpenRegisterForm } from "./pos-open-register-form";
import { PosPairingForm } from "./pos-pairing-form";
import { PosSaleScreen } from "./pos-sale-screen";
import { loadAllCatalogRows, resolveStartPhase, type PosStartPhase } from "./pos-start";

export interface PosTerminalProps {
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
}

/** The device cookie only reaches the API, so the first screen is decided in the browser. */
type SellingView = Extract<PosStartPhase, { readonly kind: "selling" }>;

/** Closing keeps the sale view it came from, so "back to the sale" restores the same register and rows. */
type TerminalView =
  | PosStartPhase
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "closing"; readonly sellingView: SellingView };

export function PosTerminal(props: PosTerminalProps): ReactElement {
  const { organizationId, currency, locale, labels } = props;
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

  /** Back from the close screen returns to the same register; a finished close starts again from the top. */
  async function handleCloseDone(): Promise<void> {
    try {
      setView(await resolveStartPhase(organizationId));
    } catch {
      setView({ kind: "failed" });
    }
  }

  return (
    <TerminalScreen
      view={view}
      organizationId={organizationId}
      currency={currency}
      locale={locale}
      labels={labels}
      onRetry={() => setAttempt((count) => count + 1)}
      onPair={handlePair}
      onOpen={handleOpen}
      onStartClose={(sellingView) => setView({ kind: "closing", sellingView })}
      onBackToSale={(sellingView) => setView(sellingView)}
      onCloseDone={() => void handleCloseDone()}
    />
  );
}

interface TerminalScreenProps {
  readonly view: TerminalView;
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly onRetry: () => void;
  readonly onPair: (pairingCode: string) => Promise<void>;
  readonly onOpen: (openingFloat: Money) => Promise<void>;
  readonly onStartClose: (sellingView: SellingView) => void;
  readonly onBackToSale: (sellingView: SellingView) => void;
  readonly onCloseDone: () => void;
}

function FailedStart(props: {
  readonly labels: PosLabels;
  readonly onRetry: () => void;
}): ReactElement {
  const { labels, onRetry } = props;
  return (
    <div className="flex flex-col items-start gap-3 p-4">
      <p role="alert" className="text-body text-danger">
        {labels.loadFailed}
      </p>
      <Button className="min-h-14" onClick={onRetry}>
        {labels.retry}
      </Button>
    </div>
  );
}

/** Picks the one screen the till is on: loading, failed, pair, open, or sell. */
function TerminalScreen(props: TerminalScreenProps): ReactElement {
  const { view, organizationId, currency, locale, labels, onRetry, onPair, onOpen } = props;
  if (view.kind === "loading") {
    return <p className="p-4 text-body text-secondary">{labels.loading}</p>;
  }
  if (view.kind === "failed") {
    return <FailedStart labels={labels} onRetry={onRetry} />;
  }
  if (view.kind === "pairing") {
    return <PosPairingForm labels={labels} onPair={onPair} />;
  }
  if (view.kind === "opening") {
    return (
      <PosOpenRegisterForm
        labels={labels}
        currency={currency}
        failureText={labels.loadFailed}
        onOpen={onOpen}
      />
    );
  }
  if (view.kind === "closing") {
    return (
      <PosCloseLazy
        organizationId={organizationId}
        currency={currency}
        locale={locale}
        labels={labels}
        onBack={() => props.onBackToSale(view.sellingView)}
        onDone={props.onCloseDone}
      />
    );
  }
  return (
    <PosSaleScreen
      organizationId={organizationId}
      locationId={view.session.locationId}
      currency={currency}
      locale={locale}
      labels={labels}
      rows={view.rows}
      onCloseRegister={() => props.onStartClose(view)}
    />
  );
}
