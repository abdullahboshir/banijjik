"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { PosSaleResponse } from "@banijjik/contracts/pos";
import { Button, formatMoney, type DisplayLocale } from "@banijjik/ui";
import { moneyFromInput } from "@banijjik/web-client";
import { useState, type ReactElement } from "react";
import type { CartLine } from "./cart";
import type { TillCustomer } from "./till-customer";
import type { PosLabels } from "./pos-labels";
import { CustomerBlock } from "./pos-sheet-customer-block";
import { useSheetCheckout, type SaleCustomerInput, type SheetCheckout } from "./pos-sheet-checkout";
import { CREDIT_ONLY_PLAN, useSheetCustomer } from "./pos-sheet-customer";
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
  /** Customer lookup needs contact and store-credit read; without them the sale is anonymous. */
  readonly canFindCustomer: boolean;
  readonly initialCustomer: TillCustomer | null;
  readonly onCustomerChange: (customer: TillCustomer | null) => void;
  readonly priceOverrideToken: string | null;
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
function cashDueMinorOf(payableMinor: number, rows: readonly TenderRow[]): number {
  const nonCashMinor = rows.reduce((sum, row) => sum + Math.max(row.amountMinor, 0), 0);
  return Math.max(payableMinor - nonCashMinor, 0);
}

interface TenderState {
  readonly plan: TenderPlan;
  readonly cashDueMinor: number;
}

function tenderStateOf(input: {
  readonly payableMinor: number;
  readonly currency: CurrencyCode;
  readonly rows: readonly DraftTenderRow[];
  readonly cashText: string;
}): TenderState {
  const { payableMinor, currency, rows, cashText } = input;
  const tenderRows = tenderRowsOf(rows, currency);
  const cashDueMinor = cashDueMinorOf(payableMinor, tenderRows);
  const cashReceivedMinor = cashReceivedMinorOf(cashText, cashDueMinor, currency);
  const plan = planTender({
    totalMinor: payableMinor,
    currency,
    rows: tenderRows,
    cashReceivedMinor,
  });
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

/** The sale's failure note, the actions and the offline note under the tender. */
function SheetFooter(props: {
  readonly labels: PosLabels;
  readonly plan: TenderPlan;
  readonly checkout: SheetCheckout;
  readonly onBack: () => void;
  readonly customer: SaleCustomerInput;
}): ReactElement {
  const { labels, plan, checkout, onBack, customer } = props;
  const isOnline = useOnlineStatus();
  return (
    <>
      {checkout.saleFailed !== undefined ? (
        <p role="alert" className="text-body text-danger">
          {checkout.saleFailed}
        </p>
      ) : null}
      <SheetActions
        labels={labels}
        plan={plan}
        pending={checkout.pending}
        isOnline={isOnline}
        onBack={onBack}
        onConfirm={() => void checkout.confirm(plan, customer)}
      />
      {isOnline ? null : (
        <p role="status" className="text-body text-warning">
          {labels.offline}
        </p>
      )}
    </>
  );
}

/** The bill and, once store credit applies, what is still to pay. */
function SheetTotals(props: {
  readonly labels: PosLabels;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly totalMinor: number;
  readonly payableMinor: number;
}): ReactElement {
  const { labels, currency, locale, totalMinor, payableMinor } = props;
  const total = formatMoney({ amount: totalMinor, currency }, { locale });
  const toPay = formatMoney({ amount: payableMinor, currency }, { locale });
  return (
    <>
      <h2 className="text-h2 font-semibold text-primary">{labels.payLabels.title}</h2>
      <p className="text-h2 font-semibold text-primary">
        {labels.total}: {total}
      </p>
      {payableMinor === totalMinor ? null : (
        <p className="text-body text-primary">{`${labels.customerLabels.toPay}: ${toPay}`}</p>
      )}
    </>
  );
}

/** The typed tender and its plan. A credit sale ignores the tender rows: nothing is paid now. */
function useSheetTender(payableMinor: number, currency: CurrencyCode, creditSale: boolean) {
  const [rows, setRows] = useState<readonly DraftTenderRow[]>([]);
  const [cashText, setCashText] = useState("");
  const tender = tenderStateOf({ payableMinor, currency, rows, cashText });
  const plan = creditSale ? CREDIT_ONLY_PLAN : tender.plan;
  return { rows, setRows, cashText, setCashText, plan, tender };
}

function tenderEditorOf(input: {
  readonly creditSale: boolean;
  readonly labels: PosLabels;
  readonly locale: DisplayLocale;
  readonly currency: CurrencyCode;
  readonly tender: ReturnType<typeof useSheetTender>["tender"];
  readonly rows: readonly DraftTenderRow[];
  readonly cashText: string;
  readonly onRowsChange: (rows: readonly DraftTenderRow[]) => void;
  readonly onCashTextChange: (value: string) => void;
}): ReactElement | null {
  if (input.creditSale) return null;
  const { tender } = input;
  return (
    <PosTenderEditor
      labels={input.labels}
      locale={input.locale}
      currency={input.currency}
      cashDueMinor={tender.cashDueMinor}
      rows={input.rows}
      cashText={input.cashText}
      changeMinor={tender.plan.ok ? tender.plan.changeMinor : 0}
      refusal={tender.plan.ok ? null : tender.plan.refusal}
      onRowsChange={input.onRowsChange}
      onCashTextChange={input.onCashTextChange}
    />
  );
}

function usePaymentSheetState(props: {
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly totalMinor: number;
  readonly lines: readonly CartLine[];
  readonly onPaid: (sale: PosSaleResponse) => void;
  readonly priceOverrideToken: string | null;
  readonly initialCustomer: TillCustomer | null;
  readonly onCustomerChange: (customer: TillCustomer | null) => void;
}) {
  const checkout = useSheetCheckout(props);
  const sheet = useSheetCustomer({
    totalMinor: props.totalMinor,
    currency: props.currency,
    initialCustomer: props.initialCustomer,
    onCustomerChange: props.onCustomerChange,
  });
  const tender = useSheetTender(sheet.payableMinor, props.currency, sheet.creditSale);
  return { checkout, sheet, tender };
}

function PaymentSheetBody(props: {
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly lines: readonly CartLine[];
  readonly labels: PosLabels;
  readonly totalMinor: number;
  readonly canFindCustomer: boolean;
  readonly initialCustomer: TillCustomer | null;
  readonly onCustomerChange: (customer: TillCustomer | null) => void;
  readonly priceOverrideToken: string | null;
  readonly onPaid: (sale: PosSaleResponse) => void;
  readonly onBack: () => void;
}): ReactElement {
  const { organizationId, currency, locale, labels, totalMinor, onBack } = props;
  const { checkout, sheet, tender: tenderState } = usePaymentSheetState(props);
  const { rows, setRows, cashText, setCashText, plan, tender } = tenderState;
  const tenderEditor = tenderEditorOf({
    creditSale: sheet.creditSale,
    labels,
    locale,
    currency,
    tender,
    rows,
    cashText,
    onRowsChange: setRows,
    onCashTextChange: setCashText,
  });
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <SheetTotals
        labels={labels}
        currency={currency}
        locale={locale}
        totalMinor={totalMinor}
        payableMinor={sheet.payableMinor}
      />
      <CustomerBlock
        canFind={props.canFindCustomer}
        organizationId={organizationId}
        currency={currency}
        locale={locale}
        labels={labels}
        sheet={sheet}
      />
      {tenderEditor}
      <SheetFooter
        labels={labels}
        plan={plan}
        checkout={checkout}
        onBack={onBack}
        customer={sheet.saleCustomer}
      />
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
 * Payment for the cart: the server's quoted total, the customer and store credit, the typed tender,
 * and one checkout attempt. Pay stays off until the price is quoted, the tender is valid and the
 * browser is online.
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
      canFindCustomer={props.canFindCustomer}
      initialCustomer={props.initialCustomer}
      onCustomerChange={props.onCustomerChange}
      priceOverrideToken={props.priceOverrideToken}
      onPaid={onPaid}
      onBack={onBack}
    />
  );
}
