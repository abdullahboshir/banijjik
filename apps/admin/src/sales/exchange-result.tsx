"use client";

import type { SalesExchangeResponse } from "@banijjik/contracts/sales";
import { Button, MoneyText, type DisplayLocale } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import type { ExchangeLabels } from "./exchange-labels";

export interface ExchangeResultProps {
  readonly orgSlug: string;
  readonly created: SalesExchangeResponse;
  readonly locale: DisplayLocale;
  readonly labels: ExchangeLabels;
  readonly onClose: () => void;
}

/** The result of a saved exchange: both numbers, the credit left, and links to the return and the new order. */
export function ExchangeResult(props: ExchangeResultProps): ReactElement {
  const { created, labels, locale } = props;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body font-medium text-primary">{labels.resultTitle}</p>
      <p className="text-body text-secondary">{labels.resultLead}</p>
      <dl className="flex flex-col gap-2 rounded-lg bg-surface p-4">
        <div className="flex justify-between gap-3">
          <dt className="text-body text-muted">{labels.newTotal}</dt>
          <dd>
            <MoneyText money={created.order.totals.grandTotal} locale={locale} />
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-body text-muted">{labels.creditLeft}</dt>
          <dd>
            <MoneyText money={created.storeCreditLeft} locale={locale} />
          </dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2">
        <Link
          href={`/${props.orgSlug}/returns/${created.salesReturn.salesReturnId}`}
          className="inline-flex min-h-11 items-center text-body text-brand underline"
        >
          {labels.openReturn}
        </Link>
        <Link
          href={`/${props.orgSlug}/orders/${created.order.orderId}`}
          className="inline-flex min-h-11 items-center text-body text-brand underline"
        >
          {labels.openOrder}
        </Link>
      </div>
      <Button variant="secondary" onClick={props.onClose}>
        {labels.close}
      </Button>
    </div>
  );
}
