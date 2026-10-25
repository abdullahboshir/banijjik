"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import { PAYMENT_METHOD, type PaymentMethod } from "@banijjik/contracts/payment";
import { newId } from "@banijjik/ids";
import { Button, Select, TextInput, formatMoney, type DisplayLocale } from "@banijjik/ui";
import { moneyFromInput, moneyToInputText } from "@banijjik/web-client";
import type { ReactElement } from "react";
import type { PosLabels, PosPayLabels } from "./pos-labels";
import { quickCashOptions, type TenderRefusal } from "./till-payment";

/** A non-cash tender row as the cashier types it; the amount stays text until it is read as money. */
export interface DraftTenderRow {
  readonly rowKey: string;
  readonly method: PaymentMethod;
  readonly amountText: string;
}

export interface PosTenderEditorProps {
  readonly labels: PosLabels;
  readonly locale: DisplayLocale;
  readonly currency: CurrencyCode;
  readonly cashDueMinor: number;
  readonly rows: readonly DraftTenderRow[];
  readonly cashText: string;
  readonly changeMinor: number;
  readonly refusal: TenderRefusal | null;
  readonly onRowsChange: (rows: readonly DraftTenderRow[]) => void;
  readonly onCashTextChange: (text: string) => void;
}

/** The methods a till takes besides cash, in the order the cashier sees them. */
export const NON_CASH_TILL_METHODS: readonly PaymentMethod[] = [
  PAYMENT_METHOD.BKASH,
  PAYMENT_METHOD.NAGAD,
  PAYMENT_METHOD.CARD,
  PAYMENT_METHOD.BANK,
];

export function methodLabelOf(labels: PayMethodLabels, method: PaymentMethod): string {
  if (method === PAYMENT_METHOD.CASH) return labels.cash;
  if (method === PAYMENT_METHOD.BKASH) return labels.methodBkash;
  if (method === PAYMENT_METHOD.NAGAD) return labels.methodNagad;
  if (method === PAYMENT_METHOD.CARD) return labels.methodCard;
  return labels.methodBank;
}

type PayMethodLabels = Pick<
  PosPayLabels,
  "cash" | "methodBkash" | "methodNagad" | "methodCard" | "methodBank"
>;

function refusalTextOf(labels: PosPayLabels, refusal: TenderRefusal): string {
  const byRefusal: Record<TenderRefusal, string> = {
    invalidAmount: labels.refusalInvalidAmount,
    overpaymentNotCash: labels.refusalOverpaymentNotCash,
    cashShort: labels.refusalCashShort,
    tooManyRows: labels.refusalTooManyRows,
  };
  return byRefusal[refusal];
}

/** The method picked from the list, or the current one when the value is not a till method. */
function pickedMethod(value: string, current: PaymentMethod): PaymentMethod {
  return NON_CASH_TILL_METHODS.find((method) => method === value) ?? current;
}

function DraftRowFields(props: {
  readonly labels: PosLabels;
  readonly row: DraftTenderRow;
  readonly onChange: (row: DraftTenderRow) => void;
  readonly onRemove: () => void;
}): ReactElement {
  const { labels, row, onChange, onRemove } = props;
  const methodName = methodLabelOf(labels.payLabels, row.method);
  return (
    <li className="flex flex-wrap items-center gap-2">
      <Select
        aria-label={methodName}
        value={row.method}
        onChange={(event) =>
          onChange({ ...row, method: pickedMethod(event.target.value, row.method) })
        }
        className="min-h-14 min-w-40"
      >
        {NON_CASH_TILL_METHODS.map((method) => (
          <option key={method} value={method}>
            {methodLabelOf(labels.payLabels, method)}
          </option>
        ))}
      </Select>
      <TextInput
        inputMode="decimal"
        aria-label={`${methodName} ${labels.payLabels.amount}`}
        value={row.amountText}
        onChange={(event) => onChange({ ...row, amountText: event.target.value.trim() })}
        className="min-h-14 min-w-32 flex-1 text-h3"
      />
      <Button variant="ghost" className="min-h-14" aria-label={labels.remove} onClick={onRemove}>
        ×
      </Button>
    </li>
  );
}

function CashBox(props: {
  readonly labels: PosLabels;
  readonly formatted: (minor: number) => string;
  readonly cashDueMinor: number;
  readonly cashText: string;
  readonly changeMinor: number;
  readonly currency: CurrencyCode;
  readonly onCashTextChange: (text: string) => void;
}): ReactElement {
  const { labels, formatted, cashDueMinor, cashText, changeMinor, currency, onCashTextChange } =
    props;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-default bg-surface p-3">
      <p className="text-body text-secondary">
        {labels.payLabels.cash}: {formatted(cashDueMinor)}
      </p>
      <label className="flex flex-col gap-1 text-body font-semibold text-primary">
        {labels.payLabels.received}
        <TextInput
          inputMode="decimal"
          value={cashText}
          onChange={(event) => onCashTextChange(event.target.value.trim())}
          className="min-h-14 text-h3"
        />
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label={labels.payLabels.quickCash}>
        {quickCashOptions(cashDueMinor).map((option) => (
          <Button
            key={option}
            variant="secondary"
            className="min-h-14"
            onClick={() => onCashTextChange(moneyToInputText({ amount: option, currency }))}
          >
            {formatted(option)}
          </Button>
        ))}
      </div>
      <p className="text-h3 font-semibold text-primary">
        {labels.payLabels.change}: {formatted(Math.max(changeMinor, 0))}
      </p>
    </div>
  );
}

/** The cashier's typed tender: non-cash rows, then cash received with quick figures and the change. */
export function PosTenderEditor(props: PosTenderEditorProps): ReactElement {
  const { labels, locale, currency, cashDueMinor, rows, cashText, changeMinor, refusal } = props;
  const { onRowsChange, onCashTextChange } = props;
  const formatted = (minor: number): string => formatMoney({ amount: minor, currency }, { locale });

  function replaceRow(index: number, next: DraftTenderRow): void {
    onRowsChange(rows.map((row, position) => (position === index ? next : row)));
  }

  function removeRow(index: number): void {
    onRowsChange(rows.filter((_row, position) => position !== index));
  }

  function addRow(): void {
    onRowsChange([...rows, { rowKey: newId(), method: PAYMENT_METHOD.CARD, amountText: "" }]);
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <DraftRowFields
            key={row.rowKey}
            labels={labels}
            row={row}
            onChange={(next) => replaceRow(index, next)}
            onRemove={() => removeRow(index)}
          />
        ))}
      </ul>
      <Button variant="secondary" className="min-h-14" onClick={addRow}>
        {labels.payLabels.addRow}
      </Button>
      <CashBox
        labels={labels}
        formatted={formatted}
        cashDueMinor={cashDueMinor}
        cashText={cashText}
        changeMinor={changeMinor}
        currency={currency}
        onCashTextChange={onCashTextChange}
      />
      {refusal ? (
        <p role="alert" className="text-body text-danger">
          {refusalTextOf(labels.payLabels, refusal)}
        </p>
      ) : null}
    </div>
  );
}

/** Reads what the cashier typed in the cash box. Empty means the exact cash due; unreadable is -1 (refused). */
export function cashReceivedMinorOf(
  cashText: string,
  cashDueMinor: number,
  currency: CurrencyCode,
): number {
  if (cashText === "") return cashDueMinor;
  return moneyFromInput(cashText, currency)?.amount ?? -1;
}
