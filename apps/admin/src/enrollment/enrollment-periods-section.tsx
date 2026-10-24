"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import {
  ENROLLMENT_PERIOD_STATUS,
  type EnrollmentPeriodResponse,
  type EnrollmentResponse,
} from "@banijjik/contracts/enrollment";
import {
  PAYMENT_REQUEST_TYPE,
  type PaymentMethod,
  type PaymentRequestType,
} from "@banijjik/contracts/payment";
import { Button, formatMoney, type DisplayLocale } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { PaymentLabels } from "../payments/payment-labels";
import { ReceivePaymentSheetLazy } from "../payments/receive-payment-sheet-lazy";

export interface EnrollmentPeriodsLabels {
  readonly title: string;
  readonly fee: string;
  readonly sessions: string;
  readonly receivePayment: string;
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

function PeriodRow(props: {
  period: EnrollmentPeriodResponse;
  props: EnrollmentPeriodsSectionProps;
  onPay: (period: EnrollmentPeriodResponse) => void;
}): ReactElement {
  const { period, props: section } = props;
  const { labels } = section;
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
    </li>
  );
}

export function EnrollmentPeriodsSection(props: EnrollmentPeriodsSectionProps): ReactElement {
  const router = useRouter();
  const [payingPeriod, setPayingPeriod] = useState<EnrollmentPeriodResponse | undefined>(undefined);
  const [isUpdating, setIsUpdating] = useState(false);
  const { enrollment, labels } = props;
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
          />
        ))}
      </ul>
      {payingPeriod ? (
        <ReceivePaymentSheetLazy
          open
          onOpenChange={(open: boolean) => (open ? undefined : setPayingPeriod(undefined))}
          organizationId={props.organizationId}
          currency={props.currency}
          currencySymbol={props.currencySymbol}
          allowedMethods={props.allowedMethods}
          locations={[{ locationId: enrollment.locationId, name: props.locationName }]}
          initialLocationId={enrollment.locationId}
          initialContactId={enrollment.billToContactId}
          initialAllocations={[
            {
              requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
              requestId: payingPeriod.enrollmentPeriodId,
              requestNumber: `${enrollment.enrollmentNumber} · ${labels.periodNames[payingPeriod.periodNumber]}`,
              amount: {
                amount: dueMinorOf(payingPeriod, props.dueMinorByPeriodId),
                currency: props.currency,
              },
            },
          ]}
          initialDueMinor={dueMinorOf(payingPeriod, props.dueMinorByPeriodId)}
          onSuccess={() => {
            setPayingPeriod(undefined);
            setIsUpdating(true);
            router.refresh();
          }}
          labels={labels.sheetLabels}
        />
      ) : null}
    </section>
  );
}
