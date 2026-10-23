"use client";

import {
  PAYMENT_METHOD,
  type PaymentMethod,
  type PaymentRequestType,
} from "@banijjik/contracts/payment";
import { TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { PaymentLabels } from "./payment-labels";

export interface AllocationDraft {
  readonly requestType: PaymentRequestType;
  readonly requestId: string;
  readonly amountMinor: number;
}

export interface AllocationsEditorProps {
  readonly allocations: readonly AllocationDraft[];
  readonly label: string;
  readonly disabled: boolean;
  readonly onChange: (index: number, newMinor: number) => void;
}

export function AllocationsEditor(props: AllocationsEditorProps): ReactElement | null {
  const { allocations, label, disabled, onChange } = props;
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
              value={String(alloc.amountMinor / 100)}
              onChange={(e) => {
                const parsed = Number(e.target.value) * 100;
                onChange(idx, Number.isFinite(parsed) ? Math.round(parsed) : 0);
              }}
              disabled={disabled}
            />
          </div>
        </div>
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
