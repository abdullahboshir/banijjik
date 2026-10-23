"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { PaymentAllocation } from "@banijjik/contracts/payment";
import { TextInput, parseMoneyInput } from "@banijjik/ui";
import type { ReactElement } from "react";

export function RefundAllocationsList(props: {
  readonly allocations: readonly PaymentAllocation[];
  readonly allocationAmounts: readonly number[];
  readonly label: string;
  readonly disabled: boolean;
  readonly onChange: (index: number, newMinor: number) => void;
}): ReactElement | null {
  const { allocations, allocationAmounts, label, disabled, onChange } = props;
  if (allocations.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-default p-3">
      <span className="text-body-sm font-semibold text-primary">{label}</span>
      {allocations.map((alloc, idx) => (
        <div key={alloc.requestId} className="flex items-center justify-between gap-2">
          <span className="text-body-sm text-secondary">
            {`${alloc.requestType} (${alloc.requestId.slice(0, 8)}...)`}
          </span>
          <div className="w-32">
            <TextInput
              inputMode="decimal"
              value={String((allocationAmounts[idx] ?? alloc.amount.amount) / 100)}
              onChange={(e) => {
                const parsed = parseMoneyInput(e.target.value, 2)?.minorUnits ?? 0;
                onChange(idx, parsed);
              }}
              disabled={disabled}
            />
          </div>
        </div>
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
