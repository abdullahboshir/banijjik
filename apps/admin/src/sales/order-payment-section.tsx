"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { OrderResponse } from "@banijjik/contracts/sales";
import { Button, StatusBadge, formatMoney, type DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { OrderLabels } from "./order-labels";

export interface OrderPaymentSectionProps {
  readonly order: OrderResponse;
  readonly remainingDueMinor: number;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: OrderLabels;
  readonly showPayButton: boolean;
  readonly onReceivePayment: () => void;
}

/** The payment chip, the total and the amount still due; the numbers come from the API. */
export function OrderPaymentSection(props: OrderPaymentSectionProps): ReactElement {
  const { order, labels } = props;
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-default bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-title font-semibold text-primary">{labels.detail.payment}</h2>
          <StatusBadge
            requestType="PAYMENT"
            status={order.paymentStatus}
            label={labels.paymentStatus[order.paymentStatus]}
          />
        </div>
        {props.showPayButton ? (
          <Button type="button" onClick={props.onReceivePayment}>
            {labels.detail.receivePayment}
          </Button>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-4 border-t border-default/50 pt-3 text-body-sm">
        <div>
          <dt className="text-caption text-secondary">{labels.detail.total}</dt>
          <dd className="font-money text-h3 font-semibold text-primary">
            {formatMoney(order.totals.grandTotal, { locale: props.locale })}
          </dd>
        </div>
        {props.remainingDueMinor > 0 ? (
          <div>
            <dt className="text-caption text-secondary">{labels.detail.due}</dt>
            <dd className="font-money text-body font-medium text-warning">
              {formatMoney(
                { amount: props.remainingDueMinor, currency: props.currency },
                { locale: props.locale },
              )}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
