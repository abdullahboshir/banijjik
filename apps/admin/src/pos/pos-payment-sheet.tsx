"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { PosSaleResponse } from "@banijjik/contracts/pos";
import { Button, formatMoney, type DisplayLocale } from "@banijjik/ui";
import { moneyFromInput } from "@banijjik/web-client";
import { useState, type ReactElement } from "react";
import type { CartLine } from "./cart";
import type { PosLabels } from "./pos-labels";
import { useSheetCheckout } from "./pos-sheet-checkout";
import { useSheetQuote } from "./pos-sheet-quote";
import { cashReceivedMinorOf, PosTenderEditor, type DraftTenderRow } from "./pos-tender-editor";
import { planTender, type TenderPlan, type TenderRow } from "./till-payment";
import { useOnlineStatus } from "./use-online-status";

export interface PosPaymentSheetProps {
  readonly organizationId: string;
  readonly locationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly lines: readonly CartLine[];
  readonly labels: PosLabels;
  readonly onPaid: (sale: PosSaleResponse) => void;
  readonly onBack: () => void;
}

function tenderRowsOf(rows: readonly DraftTenderRow[], currency: CurrencyCode): TenderRow[] {
  return rows.map((row) => ({
    rowKey: row.rowKey,
    method: row.method,
    amountMinor: moneyFromInput(row.amountText, currency)?.amount ?? -1,
  }));
}

/** What the cash box must still cover: the bill less the readable non-cash rows, never below zero. */
function cashDueMinorOf(totalMinor: number, rows: readonly TenderRow[]): number {
  const nonCashMinor = rows.reduce((sum, row) => sum + Math.max(row.amountMinor, 0), 0);
  return Math.max(totalMinor - nonCashMinor, 0);
}

interface TenderState {
  readonly plan: TenderPlan;
  readonly cashDueMinor: number;
}

function tenderStateOf(input: {
  readonly totalMinor: number;
  readonly currency: CurrencyCode;
  readonly rows: readonly DraftTenderRow[];
  readonly cashText: string;
}): TenderState {
  const { totalMinor, currency, rows, cashText } = input;
  const tenderRows = tenderRowsOf(rows, currency);
  const cashDueMinor = cashDueMinorOf(totalMinor, tenderRows);
  const cashReceivedMinor = cashReceivedMinorOf(cashText, cashDueMinor, currency);
  const plan = planTender({ totalMinor, currency, rows: tenderRows, cashReceivedMinor });
  return { plan, cashDueMinor };
}

function SheetActions(props: {
  readonly labels: PosLabels;
  readonly plan: TenderPlan;
  readonly pending: boolean;
  readonly isOnline: boolean;
  readonly onBack: () => void;
  readonly onConfirm: () => void;
}): ReactElement {
  const { labels, plan, pending, isOnline, onBack, onConfirm } = props;
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button variant="secondary" className="min-h-14 flex-1" onClick={onBack}>
        {labels.payLabels.back}
      </Button>
      <Button
        className="min-h-14 flex-1"
        isLoading={pending}
        disabled={!plan.ok || !isOnline}
        onClick={onConfirm}
      >
        {labels.payLabels.confirm}
      </Button>
    </div>
  );
}

/** The tender and the confirm step, once the total is quoted. */
function PaymentSheetBody(props: {
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly lines: readonly CartLine[];
  readonly labels: PosLabels;
  readonly totalMinor: number;
  readonly onPaid: (sale: PosSaleResponse) => void;
  readonly onBack: () => void;
}): ReactElement {
  const { organizationId, currency, locale, lines, labels, totalMinor, onPaid, onBack } = props;
  const [rows, setRows] = useState<readonly DraftTenderRow[]>([]);
  const [cashText, setCashText] = useState("");
  const isOnline = useOnlineStatus();
  const checkout = useSheetCheckout(organizationId, lines, onPaid);
  const { plan, cashDueMinor } = tenderStateOf({ totalMinor, currency, rows, cashText });
  const total = formatMoney({ amount: totalMinor, currency }, { locale });
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <h2 className="text-h2 font-semibold text-primary">{labels.payLabels.title}</h2>
      <p className="text-h2 font-semibold text-primary">
        {labels.total}: {total}
      </p>
      <PosTenderEditor
        labels={labels}
        locale={locale}
        currency={currency}
        cashDueMinor={cashDueMinor}
        rows={rows}
        cashText={cashText}
        changeMinor={plan.ok ? plan.changeMinor : 0}
        refusal={plan.ok ? null : plan.refusal}
        onRowsChange={setRows}
        onCashTextChange={setCashText}
      />
      {checkout.saleFailed ? (
        <p role="alert" className="text-body text-danger">
          {labels.saleFailed}
        </p>
      ) : null}
      <SheetActions
        labels={labels}
        plan={plan}
        pending={checkout.pending}
        isOnline={isOnline}
        onBack={onBack}
        onConfirm={() => void checkout.confirm(plan)}
      />
      {isOnline ? null : (
        <p role="status" className="text-body text-warning">
          {labels.offline}
        </p>
      )}
    </section>
  );
}

function SheetFailure(props: {
  readonly labels: PosLabels;
  readonly onBack: () => void;
}): ReactElement {
  const { labels, onBack } = props;
  return (
    <div className="flex flex-col items-start gap-3 p-4">
      <p role="alert" className="text-body text-danger">
        {labels.payLabels.quoteFailed}
      </p>
      <Button variant="secondary" className="min-h-14" onClick={onBack}>
        {labels.payLabels.back}
      </Button>
    </div>
  );
}

/**
 * Payment for the cart: the server's quoted total, the typed tender, and one checkout attempt. Pay
 * stays off until the price is quoted, the tender is valid and the browser is online.
 */
export function PosPaymentSheet(props: PosPaymentSheetProps): ReactElement {
  const { organizationId, locationId, currency, locale, lines, labels, onPaid, onBack } = props;
  const quote = useSheetQuote(organizationId, locationId, lines);
  if (quote.kind === "loading") {
    return <p className="p-4 text-body text-secondary">{labels.loading}</p>;
  }
  if (quote.kind === "failed") {
    return <SheetFailure labels={labels} onBack={onBack} />;
  }
  return (
    <PaymentSheetBody
      organizationId={organizationId}
      currency={currency}
      locale={locale}
      lines={lines}
      labels={labels}
      totalMinor={quote.totalMinor}
      onPaid={onPaid}
      onBack={onBack}
    />
  );
}
