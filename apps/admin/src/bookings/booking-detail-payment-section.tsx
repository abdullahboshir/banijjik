"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { BookingResponse } from "@banijjik/contracts/booking";
import type { PaymentMethod } from "@banijjik/contracts/payment";
import { Button, formatMoney, type DisplayLocale } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { PaymentLabels } from "../payments/payment-labels";
import { ReceivePaymentSheetLazy } from "../payments/receive-payment-sheet-lazy";

export interface BookingDetailPaymentSectionProps {
  readonly organizationId: string;
  readonly booking: BookingResponse;
  readonly currency: CurrencyCode;
  readonly currencySymbol: string;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly canReceive: boolean;
  readonly locale: DisplayLocale;
  readonly labels: {
    readonly paymentStatus: string;
    readonly receivePayment: string;
    readonly totalPrice: string;
    readonly depositRequired: string;
    readonly statusLabels: Readonly<Record<string, string>>;
    readonly sheetLabels: PaymentLabels["receiveSheet"] & {
      readonly methodLabels: Readonly<Record<PaymentMethod, string>>;
    };
  };
}

const statusToneClasses: Record<string, string> = {
  UNPAID: "border-warning text-warning bg-warning/10",
  PARTIAL: "border-accent text-accent bg-accent/10",
  PAID: "border-success text-success bg-success/10",
  REFUNDED: "border-danger text-danger bg-danger/10",
};

function PaymentSummaryRow(props: {
  readonly booking: BookingResponse;
  readonly locale: DisplayLocale;
  readonly labels: { readonly totalPrice: string; readonly depositRequired: string };
}): ReactElement {
  const { booking, locale, labels } = props;
  const formattedTotal = formatMoney(booking.price.total, { locale });
  const hasDeposit = booking.depositRequired && booking.depositRequired.amount > 0;
  const formattedDeposit = hasDeposit ? formatMoney(booking.depositRequired, { locale }) : null;

  return (
    <div className="grid grid-cols-2 gap-4 border-t border-default/50 pt-3 text-body-sm">
      <div>
        <span className="text-caption text-secondary">{labels.totalPrice}</span>
        <p className="text-h3 font-semibold text-primary">{formattedTotal}</p>
      </div>
      {formattedDeposit ? (
        <div>
          <span className="text-caption text-secondary">{labels.depositRequired}</span>
          <p className="text-body font-medium text-warning">{formattedDeposit}</p>
        </div>
      ) : null}
    </div>
  );
}

export function BookingDetailPaymentSection(props: BookingDetailPaymentSectionProps): ReactElement {
  const router = useRouter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { booking, labels } = props;

  const paymentStatus = booking.paymentStatus ?? "UNPAID";
  const toneClass = statusToneClasses[paymentStatus] ?? "border-default text-secondary";
  const statusText = labels.statusLabels[paymentStatus] ?? paymentStatus;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-default bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-body font-semibold text-primary">{labels.paymentStatus}:</span>
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-caption font-semibold ${toneClass}`}
          >
            {statusText}
          </span>
        </div>
        {props.canReceive ? (
          <Button type="button" onClick={() => setIsSheetOpen(true)}>
            {labels.receivePayment}
          </Button>
        ) : null}
      </div>

      <PaymentSummaryRow booking={booking} locale={props.locale} labels={labels} />

      {isSheetOpen ? (
        <ReceivePaymentSheetLazy
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          organizationId={props.organizationId}
          currency={props.currency}
          currencySymbol={props.currencySymbol}
          allowedMethods={props.allowedMethods}
          locations={[{ locationId: booking.locationId, name: "Booking location" }]}
          initialLocationId={booking.locationId}
          initialContactId={booking.contactId}
          initialAllocations={[
            { requestType: "BOOKING", requestId: booking.bookingId, amount: booking.price.total },
          ]}
          initialDueMinor={booking.price.total.amount}
          onSuccess={() => {
            setIsSheetOpen(false);
            router.refresh();
          }}
          labels={labels.sheetLabels}
        />
      ) : null}
    </section>
  );
}
