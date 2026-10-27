"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/payment";
import type { PosCatalogRow, PosSessionResponse } from "@banijjik/contracts/pos";
import { Button, type DisplayLocale } from "@banijjik/ui";
import { newId } from "@banijjik/ids";
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { openSession, pairDevice } from "./pos-api";
import type { PosLabels } from "./pos-labels";
import { PosCloseLazy } from "./pos-close-lazy";
import { PosOpenRegisterForm } from "./pos-open-register-form";
import { PosPairingForm } from "./pos-pairing-form";
import { PosSaleScreen } from "./pos-sale-screen";
import { resolveStartPhase, type PosStartPhase } from "./pos-start";
import { useCatalogRefresh } from "./pos-catalog-refresh";
import { syncCatalog } from "./pos-catalog-sync";

export interface PosTerminalProps {
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly canFindCustomer: boolean;
  readonly canOverridePrice: boolean;
}

/** The device cookie only reaches the API, so the first screen is decided in the browser. */
type SellingView = Extract<PosStartPhase, { readonly kind: "selling" }>;

/** Closing keeps the sale view it came from, so "back to the sale" restores the same register and rows. */
type TerminalView =
  | PosStartPhase
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "closing"; readonly sellingView: SellingView };

/** The first screen after a change, or the failure screen when the till cannot be read again. */
async function startPhaseView(organizationId: string): Promise<TerminalView> {
  try {
    return await resolveStartPhase(organizationId);
  } catch {
    return { kind: "failed" };
  }
}

async function reloadStartPhase(
  organizationId: string,
  setView: (view: TerminalView) => void,
): Promise<void> {
  setView(await startPhaseView(organizationId));
}

export function PosTerminal(props: PosTerminalProps): ReactElement {
  const { organizationId, currency, locale, labels, canFindCustomer, canOverridePrice } = props;
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

  const sellingRegister = view.kind === "selling" ? view.session : null;
  const handleRows = useCallback(
    (posSessionId: string, rows: readonly PosCatalogRow[]) =>
      setView((current) =>
        current.kind === "selling" && current.session.posSessionId === posSessionId
          ? { ...current, rows }
          : current,
      ),
    [],
  );
  useCatalogRefresh(organizationId, sellingRegister, handleRows);

  async function handlePair(pairingCode: string): Promise<void> {
    await pairDevice(organizationId, pairingCode);
    setView(await resolveStartPhase(organizationId));
  }

  async function handleOpen(openingFloat: Money): Promise<void> {
    // One key per click: the register form is disabled while the request runs (ADR-014).
    const session: PosSessionResponse = await openSession(organizationId, openingFloat, newId());
    const rows: readonly PosCatalogRow[] = await syncCatalog(organizationId, session.locationId);
    setView({ kind: "selling", session, rows });
  }

  /** A finished close starts again from the top; a failed reload shows the failure screen. */
  const handleCloseDone = (): void => {
    void reloadStartPhase(organizationId, setView);
  };

  return (
    <TerminalScreen
      view={view}
      organizationId={organizationId}
      currency={currency}
      locale={locale}
      labels={labels}
      canFindCustomer={canFindCustomer}
      canOverridePrice={canOverridePrice}
      onRetry={() => setAttempt((count) => count + 1)}
      onPair={handlePair}
      onOpen={handleOpen}
      onStartClose={(sellingView) => setView({ kind: "closing", sellingView })}
      onBackToSale={(sellingView) => setView(sellingView)}
      onCloseDone={handleCloseDone}
    />
  );
}

interface TerminalScreenProps {
  readonly view: TerminalView;
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly canFindCustomer: boolean;
  readonly canOverridePrice: boolean;
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
      canFindCustomer={props.canFindCustomer}
      canOverridePrice={props.canOverridePrice}
      session={view.session}
      rows={view.rows}
      onCloseRegister={() => props.onStartClose(view)}
    />
  );
}
