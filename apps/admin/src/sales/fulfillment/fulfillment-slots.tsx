"use client";

import type { ReactElement } from "react";
import type { OrderDetailClientProps } from "../order-detail-client";
import { DeliveryAttemptSheet } from "./delivery-attempt-sheet";
import { DeliveryLossSheet } from "./delivery-loss-sheet";
import { OrderRtsSheet } from "./order-rts-sheet";
import { OrderShipSheet } from "./order-ship-sheet";

export type FulfillmentDialogKey =
  | "ship"
  | "reship"
  | "failAttempt"
  | "rts"
  | "reconcileLoss"
  | "recoverLoss";

export interface FulfillmentSlotsProps {
  readonly props: OrderDetailClientProps;
  readonly openDialog: string | undefined;
  readonly toggle: (key: FulfillmentDialogKey) => (open: boolean) => void;
}

export function FulfillmentSlots(props: FulfillmentSlotsProps): ReactElement | null {
  const { openDialog, toggle, props: detail } = props;
  const { organizationId, order, labels } = detail;

  if (openDialog === "ship") {
    return (
      <OrderShipSheet
        open
        onOpenChange={toggle("ship")}
        organizationId={organizationId}
        order={order}
        labels={labels}
      />
    );
  }

  if (openDialog === "reship") {
    return (
      <OrderShipSheet
        open
        isReship
        onOpenChange={toggle("reship")}
        organizationId={organizationId}
        order={order}
        labels={labels}
      />
    );
  }

  if (openDialog === "failAttempt") {
    return (
      <DeliveryAttemptSheet
        open
        onOpenChange={toggle("failAttempt")}
        organizationId={organizationId}
        order={order}
        labels={labels}
      />
    );
  }

  if (openDialog === "rts") {
    return (
      <OrderRtsSheet
        open
        onOpenChange={toggle("rts")}
        organizationId={organizationId}
        order={order}
        labels={labels}
      />
    );
  }

  if (openDialog === "reconcileLoss") {
    return (
      <DeliveryLossSheet
        open
        onOpenChange={toggle("reconcileLoss")}
        organizationId={organizationId}
        order={order}
        labels={labels}
      />
    );
  }

  if (openDialog === "recoverLoss") {
    return (
      <DeliveryLossSheet
        open
        isRecover
        onOpenChange={toggle("recoverLoss")}
        organizationId={organizationId}
        order={order}
        labels={labels}
      />
    );
  }

  return null;
}
