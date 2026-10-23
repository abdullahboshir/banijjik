"use client";

import type { PaymentDirection, PaymentResponse } from "@banijjik/contracts/payment";
import { formatMoney, type DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import { PaymentDetailActions } from "./payment-detail-actions";
import type { PaymentLabels } from "./payment-labels";

export interface PaymentDetailViewProps {
  readonly organizationId: string;
  readonly payment: PaymentResponse;
  readonly locationName?: string | undefined;
  readonly canRefund: boolean;
  readonly canReverse: boolean;
  readonly locale: DisplayLocale;
  readonly labels: PaymentLabels;
}

const directionToneClasses: Record<PaymentDirection, string> = {
  IN: "border-success text-success bg-success/10",
  REFUND: "border-warning text-warning bg-warning/10",
  REVERSAL: "border-danger text-danger bg-danger/10",
};

function OverviewExtraRows(props: {
  readonly payment: PaymentResponse;
  readonly labels: PaymentLabels;
}): ReactElement {
  const { payment, labels } = props;
  return (
    <>
      {payment.externalReference ? (
        <div className="col-span-2">
          <span className="text-caption text-secondary">{labels.detail.reference}</span>
          <p className="font-mono text-body font-medium text-primary">
            {payment.externalReference}
          </p>
        </div>
      ) : null}
      {payment.reversesPaymentId ? (
        <div className="col-span-2">
          <span className="text-caption text-secondary">{labels.detail.reversesPayment}</span>
          <p className="font-mono text-body text-danger">{payment.reversesPaymentId}</p>
        </div>
      ) : null}
      {payment.note ? (
        <div className="col-span-2">
          <span className="text-caption text-secondary">{labels.detail.note}</span>
          <p className="text-body text-primary">{payment.note}</p>
        </div>
      ) : null}
    </>
  );
}

function PaymentOverviewSection(props: {
  readonly payment: PaymentResponse;
  readonly locationName?: string | undefined;
  readonly formattedAmount: string;
  readonly toneClass: string;
  readonly labels: PaymentLabels;
}): ReactElement {
  const { payment, locationName, formattedAmount, toneClass, labels } = props;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-default bg-surface p-5">
      <h3 className="text-h3 font-semibold text-primary">{labels.detail.overview}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-caption text-secondary">{labels.detail.direction}</span>
          <div>
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-caption font-semibold ${toneClass}`}
            >
              {labels.direction[payment.direction] ?? payment.direction}
            </span>
          </div>
        </div>
        <div>
          <span className="text-caption text-secondary">{labels.detail.amount}</span>
          <p className="text-h3 font-bold text-primary">{formattedAmount}</p>
        </div>
        <div>
          <span className="text-caption text-secondary">{labels.detail.method}</span>
          <p className="text-body font-medium text-primary">
            {labels.method[payment.method] ?? payment.method}
          </p>
        </div>
        <div>
          <span className="text-caption text-secondary">{labels.detail.businessDate}</span>
          <p className="text-body text-primary">{payment.businessDate}</p>
        </div>
        <div>
          <span className="text-caption text-secondary">{labels.detail.location}</span>
          <p className="text-body text-primary">{locationName ?? payment.locationId}</p>
        </div>
        {payment.contactId ? (
          <div>
            <span className="text-caption text-secondary">{labels.detail.contact}</span>
            <p className="font-mono text-body text-primary">{payment.contactId}</p>
          </div>
        ) : null}
        <OverviewExtraRows payment={payment} labels={labels} />
      </div>
    </div>
  );
}

function PaymentAllocationsSection(props: {
  readonly payment: PaymentResponse;
  readonly locale: DisplayLocale;
  readonly labels: PaymentLabels;
}): ReactElement {
  const { payment, locale, labels } = props;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-default bg-surface p-5">
        <h3 className="text-h3 font-semibold text-primary">{labels.detail.allocations}</h3>
        {payment.allocations.length === 0 ? (
          <p className="text-body-sm text-secondary">{labels.detail.noAllocations}</p>
        ) : (
          <div className="flex flex-col divide-y divide-default">
            {payment.allocations.map((alloc) => {
              const allocFormatted = formatMoney(alloc.amount, { locale });
              const revenueLabel = alloc.revenueState
                ? (labels.detail.revenueStates[alloc.revenueState] ?? alloc.revenueState)
                : null;
              return (
                <div
                  key={alloc.requestId}
                  className="flex items-center justify-between py-2 text-body"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-primary">
                      {`${alloc.requestType} (${alloc.requestId.slice(0, 8)}...)`}
                    </span>
                    {revenueLabel ? (
                      <span className="text-caption text-secondary">{revenueLabel}</span>
                    ) : null}
                  </div>
                  <span className="font-semibold text-primary">{allocFormatted}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {payment.approval ? (
        <div className="flex flex-col gap-2 rounded-lg border border-default bg-surface p-5">
          <h3 className="text-h3 font-semibold text-primary">{labels.detail.approval}</h3>
          <div className="grid grid-cols-2 gap-2 text-body-sm">
            <div>
              <span className="text-caption text-secondary">{labels.detail.approvedBy}</span>
              <p className="font-mono text-primary">{payment.approval.approverUserId}</p>
            </div>
            <div>
              <span className="text-caption text-secondary">{labels.detail.approvedAt}</span>
              <p className="text-primary">{payment.approval.approvedAt}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PaymentDetailView(props: PaymentDetailViewProps): ReactElement {
  const { payment, locationName, canRefund, canReverse, locale, labels } = props;
  const toneClass = directionToneClasses[payment.direction] ?? "border-default text-secondary";
  const formattedAmount = formatMoney(payment.amount, { locale });

  return (
    <div className="flex flex-col gap-6">
      <PaymentDetailActions
        organizationId={props.organizationId}
        payment={payment}
        canRefund={canRefund}
        canReverse={canReverse}
        labels={labels}
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <PaymentOverviewSection
          payment={payment}
          locationName={locationName}
          formattedAmount={formattedAmount}
          toneClass={toneClass}
          labels={labels}
        />
        <PaymentAllocationsSection payment={payment} locale={locale} labels={labels} />
      </div>
    </div>
  );
}
