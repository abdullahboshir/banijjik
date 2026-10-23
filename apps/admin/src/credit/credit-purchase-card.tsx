"use client";

import type { CreditPurchaseResponse, CreditPurchaseStatus } from "@banijjik/contracts/credit";
import { formatMoney, type DisplayLocale } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { fillLabel } from "../catalog/catalog-labels";
import type { CreditPurchaseLabels } from "./credit-purchase-labels";

export interface CreditPurchaseCardProps {
  purchase: CreditPurchaseResponse;
  locale: DisplayLocale;
  labels: CreditPurchaseLabels;
  onSelect: (purchase: CreditPurchaseResponse) => void;
}

const statusToneClasses: Record<CreditPurchaseStatus, string> = {
  PENDING: "border-warning text-warning bg-warning/10",
  VERIFIED: "border-success text-success bg-success/10",
  REJECTED: "border-danger text-danger bg-danger/10",
  CANCELLED: "border-default text-secondary bg-subtle",
};

export function CopyButton(props: {
  text: string;
  labels: { copy: string; copied: string };
}): ReactElement {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    e.preventDefault();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => void handleCopy(e)}
      className="inline-flex items-center rounded border border-default px-1.5 py-0.5 text-caption text-secondary hover:bg-subtle"
      title={copied ? props.labels.copied : props.labels.copy}
    >
      {copied ? props.labels.copied : props.labels.copy}
    </button>
  );
}

function ageTextOf(submittedAt: string, labels: CreditPurchaseLabels["card"]): string {
  const diffMs = Date.now() - new Date(submittedAt).getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 24) {
    return fillLabel(labels.ageHours, { count: String(diffHours) });
  }
  const diffDays = Math.floor(diffHours / 24);
  return fillLabel(labels.ageDays, { count: String(diffDays) });
}

function packNameOf(name: { bn: string; en: string }, locale: DisplayLocale): string {
  const text = name[locale].trim();
  return text.length > 0 ? text : (locale === "bn" ? name.en : name.bn).trim();
}

function CardDetails(props: {
  purchase: CreditPurchaseResponse;
  labels: CreditPurchaseLabels;
  packName: string;
  formattedAmount: string;
}): ReactElement {
  const { purchase, labels, packName, formattedAmount } = props;
  return (
    <div className="grid grid-cols-1 gap-2 text-small sm:grid-cols-2">
      <div className="flex items-center gap-1.5">
        <span className="text-secondary">{labels.method[purchase.method]}:</span>
        <span className="font-mono font-medium">{purchase.transactionReference}</span>
        <CopyButton
          text={purchase.transactionReference}
          labels={{ copy: labels.detail.copy, copied: labels.detail.copied }}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-secondary">{labels.card.amount}:</span>
        <span className="font-semibold">{formattedAmount}</span>
        <CopyButton
          text={String(purchase.snapshot.price.amount)}
          labels={{ copy: labels.detail.copy, copied: labels.detail.copied }}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-secondary">{labels.card.pack}:</span>
        <span>
          {packName} ({purchase.snapshot.credits} {labels.detail.credits})
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-secondary">{labels.card.sender}:</span>
        <span>{purchase.senderPhoneE164}</span>
      </div>
    </div>
  );
}

export function CreditPurchaseCard(props: CreditPurchaseCardProps): ReactElement {
  const { purchase, locale, labels, onSelect } = props;
  const packName = packNameOf(purchase.snapshot.name, locale);
  const formattedAmount = formatMoney(purchase.snapshot.price, { locale });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(purchase)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(purchase);
        }
      }}
      className="flex min-h-11 cursor-pointer flex-col gap-3 rounded-lg border border-default bg-surface p-4 text-primary transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-primary">{purchase.purchaseNumber}</span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-caption font-semibold ${statusToneClasses[purchase.status]}`}
          >
            {labels.status[purchase.status]}
          </span>
        </div>
        <span className="text-small text-secondary">
          {ageTextOf(purchase.submittedAt, labels.card)}
        </span>
      </div>

      <CardDetails
        purchase={purchase}
        labels={labels}
        packName={packName}
        formattedAmount={formattedAmount}
      />

      <div className="flex justify-end pt-1">
        <span className="text-small font-semibold text-brand">{labels.card.open} →</span>
      </div>
    </div>
  );
}
