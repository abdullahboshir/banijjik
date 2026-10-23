"use client";

import {
  PAYMENT_METHOD,
  type PaymentMethod,
  type PaymentRequestType,
} from "@banijjik/contracts/payment";
import { parseMoneyInput, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { PaymentLabels } from "./payment-labels";

export interface AllocationDraft {
  readonly requestType: PaymentRequestType;
  readonly requestId: string;
  readonly amountMinor: number;
  readonly label?: string | undefined;
  readonly requestNumber?: string | null | undefined;
}

export function minorUnitsToDecimal(minor: number): string {
  const isNegative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const major = Math.floor(abs / 100);
  const cents = abs % 100;
  const sign = isNegative ? "-" : "";
  if (cents === 0) return `${sign}${major}`;
  const centsStr = cents < 10 ? `0${cents}` : String(cents);
  return `${sign}${major}.${centsStr.replace(/0+$/, "")}`;
}

export interface AllocationsEditorProps {
  readonly allocations: readonly AllocationDraft[];
  readonly label: string;
  readonly disabled: boolean;
  readonly requestTypeLabels?: Readonly<Record<PaymentRequestType, string>> | undefined;
  readonly invalidAmountLabel: string;
  readonly onChange: (index: number, newMinor: number) => void;
}

function AllocationRow(props: {
  readonly alloc: AllocationDraft;
  readonly index: number;
  readonly disabled: boolean;
  readonly requestTypeLabel: string;
  readonly invalidAmountLabel: string;
  readonly onChange: (index: number, newMinor: number) => void;
}): ReactElement {
  const { alloc, index, disabled, requestTypeLabel, invalidAmountLabel, onChange } = props;
  const [text, setText] = useState<string>(() => minorUnitsToDecimal(alloc.amountMinor));
  const [error, setError] = useState<string | undefined>();

  function handleChange(value: string): void {
    setText(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setError(invalidAmountLabel);
      return;
    }
    const parsed = parseMoneyInput(trimmed, 2);
    if (!parsed || parsed.minorUnits <= 0) {
      setError(invalidAmountLabel);
      return;
    }
    setError(undefined);
    onChange(index, parsed.minorUnits);
  }

  const label = alloc.requestNumber
    ? `${requestTypeLabel} (${alloc.requestNumber})`
    : (alloc.label ?? requestTypeLabel);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-body-sm text-secondary">{label}</span>
        <div className="w-32">
          <TextInput
            inputMode="decimal"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      {error ? <span className="text-caption text-error">{error}</span> : null}
    </div>
  );
}

export function AllocationsEditor(props: AllocationsEditorProps): ReactElement | null {
  const { allocations, label, disabled, requestTypeLabels, invalidAmountLabel, onChange } = props;
  if (allocations.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-default p-3">
      <span className="text-body-sm font-semibold text-primary">{label}</span>
      {allocations.map((alloc, idx) => (
        <AllocationRow
          key={alloc.requestId}
          alloc={alloc}
          index={idx}
          disabled={disabled}
          requestTypeLabel={requestTypeLabels?.[alloc.requestType] ?? alloc.requestType}
          invalidAmountLabel={invalidAmountLabel}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function resolveOverpaymentText(opts: {
  readonly contactId: string;
  readonly method: PaymentMethod;
  readonly formattedAmount: string;
  readonly labels: PaymentLabels["receiveSheet"];
}): string {
  const { contactId, method, formattedAmount, labels } = opts;
  if (contactId.trim()) {
    return labels.overpaymentCreditNotice.replace("{amount}", formattedAmount);
  }
  if (method === PAYMENT_METHOD.CASH) {
    return labels.overpaymentCashNotice.replace("{amount}", formattedAmount);
  }
  return labels.overpaymentError;
}

export interface OverpaymentNoticeProps {
  readonly hasOverpayment: boolean;
  readonly overpaymentRequiresContact: boolean;
  readonly contactId: string;
  readonly method: PaymentMethod;
  readonly formattedAmount: string;
  readonly labels: PaymentLabels["receiveSheet"];
}

export function OverpaymentNotice(props: OverpaymentNoticeProps): ReactElement | null {
  if (!props.hasOverpayment) return null;

  const text = resolveOverpaymentText(props);
  const toneClass = props.overpaymentRequiresContact
    ? "border border-error/20 bg-error/10 text-error"
    : "border border-accent/20 bg-accent/5 text-primary";

  return <div className={`rounded-md p-3 text-body-sm ${toneClass}`}>{text}</div>;
}
