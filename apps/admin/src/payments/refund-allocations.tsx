"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { PaymentAllocation, PaymentRequestType } from "@banijjik/contracts/payment";
import { parseMoneyInput, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { minorUnitsToDecimal } from "./receive-payment-allocations";

function RefundAllocationRow(props: {
  readonly initialAmount: number;
  readonly index: number;
  readonly disabled: boolean;
  readonly requestTypeLabel: string;
  readonly invalidAmountLabel: string;
  readonly onChange: (index: number, newMinor: number) => void;
}): ReactElement {
  const { initialAmount, index, disabled, requestTypeLabel, invalidAmountLabel, onChange } = props;
  const [text, setText] = useState<string>(() => minorUnitsToDecimal(initialAmount));
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

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-body-sm text-secondary">{requestTypeLabel}</span>
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

export function RefundAllocationsList(props: {
  readonly allocations: readonly PaymentAllocation[];
  readonly allocationAmounts: readonly number[];
  readonly label: string;
  readonly disabled: boolean;
  readonly requestTypeLabels?: Readonly<Record<PaymentRequestType, string>> | undefined;
  readonly invalidAmountLabel?: string | undefined;
  readonly onChange: (index: number, newMinor: number) => void;
}): ReactElement | null {
  const {
    allocations,
    allocationAmounts,
    label,
    disabled,
    requestTypeLabels,
    invalidAmountLabel,
    onChange,
  } = props;
  if (allocations.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-default p-3">
      <span className="text-body-sm font-semibold text-primary">{label}</span>
      {allocations.map((alloc, idx) => (
        <RefundAllocationRow
          key={alloc.requestId}
          initialAmount={allocationAmounts[idx] ?? alloc.amount.amount}
          index={idx}
          disabled={disabled}
          requestTypeLabel={requestTypeLabels?.[alloc.requestType] ?? alloc.requestType}
          invalidAmountLabel={invalidAmountLabel ?? "Amount must be greater than zero"}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

export function buildRefundAllocations(opts: {
  readonly allocations: readonly PaymentAllocation[];
  readonly parsedAmount: number;
  readonly allocationAmounts: readonly number[];
  readonly currency: CurrencyCode;
}): PaymentAllocation[] {
  return opts.allocations.map((alloc, idx) => ({
    requestType: alloc.requestType,
    requestId: alloc.requestId,
    amount: {
      amount:
        opts.allocations.length === 1
          ? opts.parsedAmount
          : (opts.allocationAmounts[idx] ?? alloc.amount.amount),
      currency: opts.currency,
    },
  }));
}
