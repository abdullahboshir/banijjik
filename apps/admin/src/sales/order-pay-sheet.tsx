"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import { PAYMENT_REQUEST_TYPE, type PaymentMethod } from "@banijjik/contracts/payment";
import type { OrderResponse } from "@banijjik/contracts/sales";
import type { ReactElement } from "react";
import type { PaymentLabels } from "../payments/payment-labels";
import { ReceivePaymentSheetLazy } from "../payments/receive-payment-sheet-lazy";

export interface OrderPaySheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly locationName: string;
  readonly remainingDueMinor: number;
  readonly currency: CurrencyCode;
  readonly currencySymbol: string;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly paymentLabels: PaymentLabels;
  readonly onPaid: () => void;
}

/** Receives a payment against this order (`requestType: ORDER`), the way bookings do. */
export function OrderPaySheet(props: OrderPaySheetProps): ReactElement | null {
  const { order, paymentLabels } = props;
  if (!props.open) return null;
  return (
    <ReceivePaymentSheetLazy
      open={props.open}
      onOpenChange={props.onOpenChange}
      organizationId={props.organizationId}
      currency={props.currency}
      currencySymbol={props.currencySymbol}
      allowedMethods={props.allowedMethods}
      locations={[{ locationId: order.locationId, name: props.locationName }]}
      initialLocationId={order.locationId}
      initialContactId={order.contactId ?? undefined}
      initialAllocations={[
        {
          requestType: PAYMENT_REQUEST_TYPE.ORDER,
          requestId: order.orderId,
          requestNumber: order.orderNumber,
          amount: { amount: props.remainingDueMinor, currency: props.currency },
        },
      ]}
      initialDueMinor={props.remainingDueMinor}
      onSuccess={props.onPaid}
      labels={{
        ...paymentLabels.receiveSheet,
        methodLabels: paymentLabels.method,
        requestTypeLabels: paymentLabels.requestType,
      }}
    />
  );
}
