"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type {
  SalesExchangePaymentMethod,
  SalesExchangePreviewResponse,
} from "@banijjik/contracts/sales";
import { Button, FormField, MoneyText, Select, TextInput, type DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import {
  canAddPayment,
  clampedAmountText,
  leftToPayMinor,
  type ExchangePaymentDraft,
} from "./exchange-model";
import { needsRefundReference } from "./return-model";
import type { ExchangeLabels } from "./exchange-labels";
import type { ReturnLabels } from "./return-labels";
import type { ExchangeFormActions } from "./use-exchange-sheet";
import type { ExchangePreviewState } from "./use-exchange-preview";

export interface ExchangePaymentStepProps {
  readonly exchange: ExchangeLabels;
  readonly returnLabels: ReturnLabels;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly methods: readonly SalesExchangePaymentMethod[];
  readonly defaultMethod: SalesExchangePaymentMethod;
  readonly methodLabels: Readonly<Record<string, string>>;
  readonly previewState: ExchangePreviewState;
  readonly payments: readonly ExchangePaymentDraft[];
  readonly actions: Pick<ExchangeFormActions, "addPayment" | "changePayment" | "removePayment">;
}

/** The server's numbers for the exchange: what the return credits, what the new order takes and what is still due. */
function ExchangeSummary(props: {
  readonly preview: SalesExchangePreviewResponse;
  readonly step: ExchangePaymentStepProps;
}): ReactElement {
  const { preview, step } = props;
  const { exchange, returnLabels, locale } = step;
  const rows = [
    { key: "value", label: returnLabels.sheet.previewValue, money: preview.salesReturn.value },
    { key: "newTotal", label: exchange.newTotal, money: preview.orderGrandTotal },
    { key: "creditUsed", label: exchange.creditUsed, money: preview.storeCreditUsed },
    { key: "creditLeft", label: exchange.creditLeft, money: preview.storeCreditLeft },
    { key: "due", label: exchange.due, money: preview.dueAmount },
  ];
  return (
    <dl className="flex flex-col gap-2 rounded-lg bg-surface p-4">
      {rows.map((row) => (
        <div key={row.key} className="flex justify-between gap-3">
          <dt className="text-body text-muted">{row.label}</dt>
          <dd>
            <MoneyText money={row.money} locale={locale} />
          </dd>
        </div>
      ))}
      <p className="text-caption text-muted">{exchange.creditNote}</p>
    </dl>
  );
}

/** The transaction reference of a mobile money payment (bKash, Nagad); the server refuses one without it. */
function ReferenceField(props: {
  readonly idPrefix: string;
  readonly draft: ExchangePaymentDraft;
  readonly step: ExchangePaymentStepProps;
}): ReactElement {
  const { draft, step } = props;
  return (
    <FormField
      label={step.returnLabels.sheet.refundReference}
      htmlFor={`${props.idPrefix}-reference`}
      required
    >
      <TextInput
        id={`${props.idPrefix}-reference`}
        value={draft.reference}
        onChange={(event) =>
          step.actions.changePayment(draft.draftId, { reference: event.target.value })
        }
      />
    </FormField>
  );
}

function PaymentLineFields(props: {
  readonly index: number;
  readonly draft: ExchangePaymentDraft;
  readonly capMinor: number;
  readonly step: ExchangePaymentStepProps;
}): ReactElement {
  const { draft, index, step } = props;
  const { exchange, methodLabels } = step;
  const idPrefix = `exchange-payment-${index}`;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <FormField label={exchange.paymentMethod} htmlFor={`${idPrefix}-method`}>
        <Select
          id={`${idPrefix}-method`}
          value={draft.method}
          onChange={(event) =>
            step.actions.changePayment(draft.draftId, {
              method: event.target.value as SalesExchangePaymentMethod,
            })
          }
        >
          {step.methods.map((method) => (
            <option key={method} value={method}>
              {methodLabels[method] ?? method}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={exchange.paymentAmount} htmlFor={`${idPrefix}-amount`}>
        <TextInput
          id={`${idPrefix}-amount`}
          inputMode="decimal"
          value={draft.amountText}
          onChange={(event) =>
            step.actions.changePayment(draft.draftId, {
              amountText: clampedAmountText(event.target.value, props.capMinor),
            })
          }
        />
      </FormField>
      {needsRefundReference(draft.method) ? (
        <ReferenceField idPrefix={idPrefix} draft={draft} step={step} />
      ) : null}
      <Button variant="secondary" onClick={() => step.actions.removePayment(draft.draftId)}>
        {exchange.removePayment}
      </Button>
    </li>
  );
}

/** Step 3 (the payments part): the server numbers, then each payment capped at what is left to pay. */
export function ExchangePaymentStep(props: ExchangePaymentStepProps): ReactElement {
  const { previewState, exchange, payments } = props;
  if (previewState.status === "failed") {
    return <p className="text-body text-danger">{props.returnLabels.sheet.previewFailed}</p>;
  }
  if (previewState.status !== "ready") {
    return <p className="text-caption text-muted">{exchange.previewNeeded}</p>;
  }
  const { preview } = previewState;
  const left = leftToPayMinor(preview, payments, "");
  return (
    <div className="flex flex-col gap-4">
      <ExchangeSummary preview={preview} step={props} />
      <p className="text-body font-medium text-primary">{exchange.paymentsTitle}</p>
      {payments.length === 0 ? (
        <p className="text-caption text-muted">{exchange.noPayment}</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {payments.map((draft, index) => (
          <PaymentLineFields
            key={draft.draftId}
            index={index}
            draft={draft}
            capMinor={leftToPayMinor(preview, payments, draft.draftId)}
            step={props}
          />
        ))}
      </ul>
      <p className="text-caption text-muted">
        {exchange.leftToPay}:{" "}
        <MoneyText money={{ amount: left, currency: props.currency }} locale={props.locale} />
      </p>
      <Button
        variant="secondary"
        disabled={!canAddPayment(payments)}
        onClick={() => props.actions.addPayment(props.defaultMethod)}
      >
        {exchange.addPayment}
      </Button>
      {canAddPayment(payments) ? null : (
        <p className="text-caption text-muted">{exchange.maxPayments}</p>
      )}
    </div>
  );
}
