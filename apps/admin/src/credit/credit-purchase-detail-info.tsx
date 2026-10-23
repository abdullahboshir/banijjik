"use client";

import type { CreditPurchaseResponse } from "@banijjik/contracts/credit";
import { Button, FormField, TextInput, formatMoney, type DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import { CopyButton } from "./credit-purchase-card";
import type { CreditPurchaseLabels } from "./credit-purchase-labels";

function formatDate(iso: string, locale: DisplayLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function packNameOf(name: { bn: string; en: string }, locale: DisplayLocale): string {
  const text = name[locale]?.trim();
  return text && text.length > 0 ? text : (locale === "bn" ? name.en : name.bn).trim();
}

function PurchaseDates(props: {
  purchase: CreditPurchaseResponse;
  locale: DisplayLocale;
  labels: CreditPurchaseLabels;
}): ReactElement {
  const { purchase, locale, labels } = props;
  return (
    <>
      <div className="flex items-center justify-between border-b border-default pb-2">
        <span className="text-secondary">{labels.detail.submittedAt}</span>
        <span>{formatDate(purchase.submittedAt, locale)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-secondary">{labels.detail.expiresAt}</span>
        <span>{formatDate(purchase.expiresAt, locale)}</span>
      </div>
      {purchase.verifiedAt ? (
        <div className="flex items-center justify-between border-t border-default pt-2 text-success">
          <span>{labels.detail.verifiedAt}</span>
          <span>{formatDate(purchase.verifiedAt, locale)}</span>
        </div>
      ) : null}
      {purchase.rejectionReason ? (
        <div className="flex flex-col gap-1 border-t border-default pt-2 text-danger">
          <span className="font-semibold">{labels.detail.rejectionReason}</span>
          <span>{purchase.rejectionReason}</span>
        </div>
      ) : null}
    </>
  );
}

export function PurchaseInfo(props: {
  purchase: CreditPurchaseResponse;
  locale: DisplayLocale;
  labels: CreditPurchaseLabels;
}): ReactElement {
  const { purchase, locale, labels } = props;
  const packName = packNameOf(purchase.snapshot.name, locale);
  const formattedAmount = formatMoney(purchase.snapshot.price, { locale });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-default p-3 text-small">
      <div className="flex items-center justify-between border-b border-default pb-2">
        <span className="text-secondary">{labels.detail.method}</span>
        <span className="font-semibold">{labels.method[purchase.method]}</span>
      </div>
      <div className="flex items-center justify-between border-b border-default pb-2">
        <span className="text-secondary">{labels.card.reference}</span>
        <div className="flex items-center gap-1.5 font-mono">
          <span>{purchase.transactionReference}</span>
          <CopyButton
            text={purchase.transactionReference}
            labels={{ copy: labels.detail.copy, copied: labels.detail.copied }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-b border-default pb-2">
        <span className="text-secondary">{labels.card.amount}</span>
        <div className="flex items-center gap-1.5 font-semibold">
          <span>{formattedAmount}</span>
          <CopyButton
            text={String(purchase.snapshot.price.amount)}
            labels={{ copy: labels.detail.copy, copied: labels.detail.copied }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-b border-default pb-2">
        <span className="text-secondary">{labels.card.pack}</span>
        <span>
          {packName} ({purchase.snapshot.credits} {labels.detail.credits})
        </span>
      </div>
      <div className="flex items-center justify-between border-b border-default pb-2">
        <span className="text-secondary">{labels.card.sender}</span>
        <span>{purchase.senderPhoneE164}</span>
      </div>
      <PurchaseDates purchase={purchase} locale={locale} labels={labels} />
    </div>
  );
}

export interface RejectFormProps {
  reason: string;
  isBusy: boolean;
  labels: CreditPurchaseLabels;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function RejectForm(props: RejectFormProps): ReactElement {
  const { reason, isBusy, labels, onReasonChange, onSubmit, onCancel } = props;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-danger/30 bg-danger/5 p-3">
      <FormField label={labels.rejectReason} htmlFor="purchase-reject-reason">
        <TextInput
          id="purchase-reject-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
        />
      </FormField>
      <div className="flex flex-wrap gap-1.5">
        {labels.reasons.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onReasonChange(r)}
            className="rounded border border-default bg-surface px-2 py-0.5 text-caption text-secondary hover:bg-subtle"
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {labels.detail.close}
        </Button>
        <Button onClick={onSubmit} isLoading={isBusy}>
          {labels.rejectSubmit}
        </Button>
      </div>
    </div>
  );
}
