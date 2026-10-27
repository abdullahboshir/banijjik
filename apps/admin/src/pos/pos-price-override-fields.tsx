"use client";

import type { Money } from "@banijjik/contracts/payment";
import {
  ApprovalPinDialog,
  Button,
  FormField,
  formatMoney,
  TextInput,
  type DisplayLocale,
} from "@banijjik/ui";
import type { ReactElement } from "react";
import { useApprovalDialogState } from "../payments/use-approval-dialog-state";
import type { CartLine } from "./cart";
import type { PosLabels } from "./pos-labels";

export interface QuoteTotals {
  readonly list: number | null;
  readonly override: number | null;
  readonly failed: boolean;
}

export function QuotedTotals(props: {
  readonly totals: QuoteTotals;
  readonly labels: PosLabels;
  readonly currency: Money["currency"];
  readonly locale: DisplayLocale;
}): ReactElement {
  const { totals, labels, currency, locale } = props;
  if (totals.failed) return <p role="alert">{labels.till.quoteFailed}</p>;
  if (totals.list === null || totals.override === null) return <p>{labels.loading}</p>;
  return (
    <dl className="flex flex-col gap-1">
      <div className="flex justify-between gap-2">
        <dt>{labels.till.listTotal}</dt>
        <dd>{formatMoney({ amount: totals.list, currency }, { locale })}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt>{labels.till.overrideTotal}</dt>
        <dd>{formatMoney({ amount: totals.override, currency }, { locale })}</dd>
      </div>
    </dl>
  );
}

export function OverrideApproval(props: {
  readonly labels: PosLabels;
  readonly approval: ReturnType<typeof useApprovalDialogState>;
  readonly onSubmit: (input: { approverMemberId: string; pin: string }) => void;
}): ReactElement {
  const { approval, labels } = props;
  return (
    <ApprovalPinDialog
      open={approval.dialogState.open}
      onOpenChange={(open) => {
        if (!open) approval.closeApproval();
      }}
      title={labels.till.price}
      approverLabel={labels.till.approver}
      pinLabel={labels.till.pin}
      submitLabel={labels.till.approvalSubmit}
      cancelLabel={labels.till.approvalCancel}
      closeLabel={labels.till.approvalClose}
      lockedMessage={labels.till.approvalLocked}
      approvers={approval.dialogState.approvers}
      isSubmitting={approval.isApproving}
      isLocked={approval.dialogState.isLocked}
      {...(approval.approvalError === undefined ? {} : { errorMessage: approval.approvalError })}
      onSubmit={props.onSubmit}
    />
  );
}

export function OverridePriceFields(props: {
  readonly line: CartLine;
  readonly listPrice: Money;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly priceText: string;
  readonly onPriceTextChange: (value: string) => void;
  readonly totals: QuoteTotals;
  readonly currency: Money["currency"];
  readonly error: string | undefined;
  readonly priceAvailable: boolean;
  readonly onCancel: () => void;
  readonly onApply: () => void;
}): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body font-semibold">
        {props.line.offeringName} · {props.line.variantName}
      </p>
      <p>
        {props.labels.till.listPrice}: {formatMoney(props.listPrice, { locale: props.locale })}
      </p>
      <FormField label={props.labels.till.unitPrice} htmlFor="pos-override-price">
        <TextInput
          id="pos-override-price"
          inputMode="decimal"
          className="min-h-14"
          value={props.priceText}
          onChange={(event) => props.onPriceTextChange(event.target.value)}
        />
      </FormField>
      <QuotedTotals
        totals={props.totals}
        labels={props.labels}
        currency={props.currency}
        locale={props.locale}
      />
      {props.error === undefined ? null : <p role="alert">{props.error}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" className="min-h-14 flex-1" onClick={props.onCancel}>
          {props.labels.till.approvalCancel}
        </Button>
        <Button
          className="min-h-14 flex-1"
          disabled={!props.priceAvailable}
          onClick={props.onApply}
        >
          {props.labels.till.applyPrice}
        </Button>
      </div>
    </div>
  );
}
