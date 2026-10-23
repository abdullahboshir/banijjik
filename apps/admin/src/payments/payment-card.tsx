"use client";

import type { PaymentDirection, PaymentResponse } from "@banijjik/contracts/payment";
import { formatMoney, type DisplayLocale } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import type { PaymentLabels } from "./payment-labels";

export interface PaymentCardProps {
  readonly payment: PaymentResponse;
  readonly basePath: string;
  readonly locationName?: string | undefined;
  readonly locale: DisplayLocale;
  readonly labels: PaymentLabels;
}

const directionToneClasses: Record<PaymentDirection, string> = {
  IN: "border-success text-success bg-success/10",
  REFUND: "border-warning text-warning bg-warning/10",
  REVERSAL: "border-danger text-danger bg-danger/10",
};

export function PaymentCard(props: PaymentCardProps): ReactElement {
  const { payment, basePath, locationName, locale, labels } = props;
  const toneClass = directionToneClasses[payment.direction] ?? "border-default text-secondary";
  const formattedAmount = formatMoney(payment.amount, { locale });

  return (
    <Link
      href={`${basePath}/${payment.paymentId}`}
      data-testid="payment-card"
      className="flex flex-col gap-3 rounded-lg border border-default bg-surface p-4 transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-accent"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-body font-bold text-primary">{payment.paymentNumber}</span>
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-caption font-semibold ${toneClass}`}
        >
          {labels.direction[payment.direction] ?? payment.direction}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-h3 font-semibold text-primary">{formattedAmount}</span>
        <span className="text-body-sm text-secondary">
          {labels.method[payment.method] ?? payment.method}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-default/50 pt-2 text-caption text-secondary">
        <span>{payment.businessDate}</span>
        {locationName ? <span>{locationName}</span> : null}
        {payment.externalReference ? (
          <span className="font-mono">{`${labels.card.reference}: ${payment.externalReference}`}</span>
        ) : null}
      </div>
    </Link>
  );
}
