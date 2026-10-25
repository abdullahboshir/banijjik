"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import {
  ENROLLMENT_PERIOD_STATUS,
  type EnrollmentPeriodResponse,
  type EnrollmentResponse,
} from "@banijjik/contracts/enrollment";
import {
  PAYMENT_METHOD,
  PAYMENT_REQUEST_TYPE,
  type Money,
  type PaymentMethod,
  type PaymentRequestType,
} from "@banijjik/contracts/payment";
import { Button, formatMoney, type DisplayLocale } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { PaymentLabels } from "../payments/payment-labels";
import { ReceivePaymentSheetLazy } from "../payments/receive-payment-sheet-lazy";
import type { RefundDialogLabels, RefundTarget } from "../payments/refund-dialog";
import { RefundDialogLazy } from "../payments/refund-dialog-lazy";

export interface EnrollmentPeriodsLabels {
  readonly title: string;
  readonly fee: string;
  readonly sessions: string;
  readonly receivePayment: string;
  readonly refund: string;
  readonly updating: string;
  readonly reloadStatus: string;
  readonly periodNames: Readonly<Record<number, string>>;
  readonly statusNames: Readonly<Record<string, string>>;
  /** A template with {used} and {allowed}: a function cannot cross from the server page. */
  readonly sessionsOf: string;
  readonly sheetLabels: PaymentLabels["receiveSheet"] & {
    readonly methodLabels: Readonly<Record<PaymentMethod, string>>;
    readonly requestTypeLabels?: Readonly<Record<PaymentRequestType, string>> | undefined;
  };
  readonly refundDialogLabels: RefundDialogLabels;
}

export interface EnrollmentPeriodsSectionProps {
  readonly organizationId: string;
  readonly enrollment: EnrollmentResponse;
  readonly periods: readonly EnrollmentPeriodResponse[];
  readonly locationName: string;
  readonly currency: CurrencyCode;
  readonly currencySymbol: string;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly canReceive: boolean;
  readonly canRefund: boolean;
  /** The amount still due per period, from the dues list; a missing entry means the API listed none. */
  readonly dueMinorByPeriodId: Readonly<Record<string, number>>;
  readonly locale: DisplayLocale;
  readonly labels: EnrollmentPeriodsLabels;
}

function isPayable(period: EnrollmentPeriodResponse): boolean {
  return (
    period.status === ENROLLMENT_PERIOD_STATUS.OPEN ||
    period.status === ENROLLMENT_PERIOD_STATUS.PARTIAL
  );
}

/** Without a dues row the full fee is safe only for an unpaid period, never for a partly paid one. */
function dueMinorOf(
  period: EnrollmentPeriodResponse,
  dueMinorByPeriodId: Readonly<Record<string, number>>,
): number {
  const listed = dueMinorByPeriodId[period.enrollmentPeriodId];
  if (listed !== undefined) return listed;
  return period.status === ENROLLMENT_PERIOD_STATUS.OPEN ? period.fee.amount : 0;
}

/** Only a cancelled enrollment's period carries a refund limit; zero or none offers no refund. */
function refundLimitOf(period: EnrollmentPeriodResponse): Money | undefined {
  const remaining = period.refundRemaining;
  if (!remaining || remaining.amount <= 0) return undefined;
  return remaining;
}

/** The refund dialog refunds one payment request: here the period, with its remaining limit. */
function periodRefundTarget(
  period: EnrollmentPeriodResponse,
  enrollment: EnrollmentResponse,
  limit: Money,
): RefundTarget {
  return {
    locationId: enrollment.locationId,
    contactId: enrollment.billToContactId,
    method: PAYMENT_METHOD.CASH,
    amount: limit,
    allocations: [
      {
        requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
        requestId: period.enrollmentPeriodId,
        amount: limit,
      },
    ],
  };
}

/** A period the staff member tapped Refund on, with the amount that refund may not pass. */
interface PendingRefund {
  readonly period: EnrollmentPeriodResponse;
  readonly limit: Money;
}

/** The sheet that receives the payment for the period the staff member tapped on. */
function ReceiveSheetForPeriod(props: {
  section: EnrollmentPeriodsSectionProps;
  period: EnrollmentPeriodResponse;
  onClose: () => void;
  onSuccess: () => void;
}): ReactElement {
  const { section } = props;
  const { enrollment, labels } = section;
  const dueMinor = dueMinorOf(props.period, section.dueMinorByPeriodId);
  return (
    <ReceivePaymentSheetLazy
      open
      onOpenChange={(open: boolean) => (open ? undefined : props.onClose())}
      organizationId={section.organizationId}
      currency={section.currency}
      currencySymbol={section.currencySymbol}
      allowedMethods={section.allowedMethods}
      locations={[{ locationId: enrollment.locationId, name: section.locationName }]}
      initialLocationId={enrollment.locationId}
      initialContactId={enrollment.billToContactId}
      initialAllocations={[
        {
          requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
          requestId: props.period.enrollmentPeriodId,
          requestNumber: `${enrollment.enrollmentNumber} · ${labels.periodNames[props.period.periodNumber]}`,
          amount: { amount: dueMinor, currency: section.currency },
        },
      ]}
      initialDueMinor={dueMinor}
      onSuccess={props.onSuccess}
      labels={labels.sheetLabels}
    />
  );
}

/** The refund dialog for the period the staff member tapped Refund on, capped at its refund left. */
function RefundDialogForPeriod(props: {
  section: EnrollmentPeriodsSectionProps;
  pendingRefund: PendingRefund;
  onClose: () => void;
  onSuccess: () => void;
}): ReactElement {
  const { section, pendingRefund } = props;
  return (
    <RefundDialogLazy
      open
      onOpenChange={(open: boolean) => (open ? undefined : props.onClose())}
      organizationId={section.organizationId}
      payment={periodRefundTarget(pendingRefund.period, section.enrollment, pendingRefund.limit)}
      maxAmount={pendingRefund.limit}
      labels={section.labels.refundDialogLabels}
      onSuccess={props.onSuccess}
    />
  );
}

function PeriodRow(props: {
  period: EnrollmentPeriodResponse;
  props: EnrollmentPeriodsSectionProps;
  onPay: (period: EnrollmentPeriodResponse) => void;
  onRefund: (period: EnrollmentPeriodResponse, limit: Money) => void;
}): ReactElement {
  const { period, props: section } = props;
  const { labels } = section;
  const refundLimit = section.canRefund ? refundLimitOf(period) : undefined;
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-default bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-body font-semibold text-primary">
          {labels.periodNames[period.periodNumber]}
        </span>
        <span className="text-small text-secondary">
          {labels.statusNames[period.status] ?? period.status}
        </span>
      </div>
      <p className="text-small text-secondary">
        {period.periodStartsOn} – {period.periodEndsOn}
      </p>
      <p className="text-body text-primary">
        {labels.fee}: {formatMoney(period.fee, { locale: section.locale })}
      </p>
      <p className="text-small text-secondary">
        {labels.sessions}:{" "}
        {period.sessionsAllowed === undefined
          ? period.sessionsUsed
          : labels.sessionsOf
              .replace("{used}", String(period.sessionsUsed))
              .replace("{allowed}", String(period.sessionsAllowed))}
      </p>
      {section.canReceive && isPayable(period) ? (
        <Button type="button" onClick={() => props.onPay(period)}>
          {labels.receivePayment}
        </Button>
      ) : null}
      {refundLimit ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => props.onRefund(period, refundLimit)}
        >
          {labels.refund}
        </Button>
      ) : null}
    </li>
  );
}

export function EnrollmentPeriodsSection(props: EnrollmentPeriodsSectionProps): ReactElement {
  const router = useRouter();
  const [payingPeriod, setPayingPeriod] = useState<EnrollmentPeriodResponse | undefined>(undefined);
  const [pendingRefund, setPendingRefund] = useState<PendingRefund | undefined>(undefined);
  const [isUpdating, setIsUpdating] = useState(false);
  const { labels } = props;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h3 font-semibold text-primary">{labels.title}</h2>
      {isUpdating ? (
        <div role="status" className="flex flex-wrap items-center gap-3 text-small text-secondary">
          <span>{labels.updating}</span>
          <Button type="button" variant="secondary" onClick={() => router.refresh()}>
            {labels.reloadStatus}
          </Button>
        </div>
      ) : null}
      <ul className="flex flex-col gap-3">
        {props.periods.map((period) => (
          <PeriodRow
            key={period.enrollmentPeriodId}
            period={period}
            props={props}
            onPay={setPayingPeriod}
            onRefund={(period, limit) => setPendingRefund({ period, limit })}
          />
        ))}
      </ul>
      {payingPeriod ? (
        <ReceiveSheetForPeriod
          section={props}
          period={payingPeriod}
          onClose={() => setPayingPeriod(undefined)}
          onSuccess={() => {
            setPayingPeriod(undefined);
            setIsUpdating(true);
            router.refresh();
          }}
        />
      ) : null}
      {pendingRefund ? (
        <RefundDialogForPeriod
          section={props}
          pendingRefund={pendingRefund}
          onClose={() => setPendingRefund(undefined)}
          onSuccess={() => {
            setPendingRefund(undefined);
            setIsUpdating(true);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
