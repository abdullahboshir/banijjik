"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { ModifierGroupResponse } from "@banijjik/contracts/catalog";
import type { PaymentMethod } from "@banijjik/contracts/payment";
import type { OrderResponse } from "@banijjik/contracts/sales";
import type { DeliveryAttempt } from "@banijjik/contracts/sales/delivery";
import type { DisplayLocale } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { PaymentLabels } from "../payments/payment-labels";
import { LazyOrderApprovalDialog } from "./lazy-order-approval-dialog";
import { canOfferExchange } from "./exchange-model";
import { canOfferReturn } from "./return-model";
import type { ReturnLabels } from "./return-labels";
import { OrderActionBar } from "./order-action-bar";
import { orderActionFlagsOf, type OrderDetailPermissions } from "./order-action-flags";
import type { OrderLabels } from "./order-labels";
import { OrderPaymentSection } from "./order-payment-section";
import { useOrderActions } from "./use-order-actions";
import { DeliveryAttemptsCard } from "./fulfillment/delivery-attempts-card";
import type { FulfillmentDialogKey } from "./fulfillment/fulfillment-slots";
import { OrderDetailSheets } from "./order-detail-sheets";

export type { OrderDetailPermissions } from "./order-action-flags";

export interface OrderDetailClientProps {
  readonly orgSlug: string;
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly locationName: string;
  readonly contactName: string | undefined;
  readonly remainingDueMinor: number;
  readonly hasNetPaid: boolean;
  readonly currency: CurrencyCode;
  readonly currencySymbol: string;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly permissions: OrderDetailPermissions;
  readonly usePacking: boolean;
  readonly modifierGroups: readonly ModifierGroupResponse[];
  readonly unitLabels: Readonly<Record<string, string>>;
  readonly locale: DisplayLocale;
  readonly labels: OrderLabels;
  readonly paymentLabels: PaymentLabels;
  /** The commission module is on, so the edit sheet offers the "Done by" select. */
  readonly performersEnabled: boolean;
  /** Whether the return window of this order is still open for the business date (plan decision 2). */
  readonly returnWindowOpen: boolean;
  readonly returnLabels: ReturnLabels;
  readonly deliveryAttempts?: readonly DeliveryAttempt[] | undefined;
}

export type DialogKey =
  | "cancel"
  | "delete"
  | "edit"
  | "pay"
  | "return"
  | "exchange"
  | FulfillmentDialogKey;

export function OrderDetailClient(props: OrderDetailClientProps): ReactElement {
  const { labels, order, permissions } = props;
  const [openDialog, setOpenDialog] = useState<DialogKey | undefined>();
  const actions = useOrderActions({
    orgSlug: props.orgSlug,
    organizationId: props.organizationId,
    order,
    currency: props.currency,
    approvalLabels: labels.approval,
  });
  const flags = orderActionFlagsOf(
    order.status,
    permissions,
    props.usePacking,
    order.fulfillment.method,
  );
  const hasDue = props.remainingDueMinor > 0;
  const returnAvailable = permissions.canReturn && canOfferReturn(order, props.returnWindowOpen);
  const exchangeAvailable =
    permissions.canExchange && canOfferExchange(order, props.returnWindowOpen);

  return (
    <>
      <OrderActionBar
        flags={flags}
        actions={actions}
        labels={labels}
        canReceive={permissions.canReceive}
        remainingDue={hasDue}
        onEdit={() => setOpenDialog("edit")}
        onCancel={() => setOpenDialog("cancel")}
        onDelete={() => setOpenDialog("delete")}
        onReceivePayment={() => setOpenDialog("pay")}
        returnAvailable={returnAvailable}
        returnLabel={props.returnLabels.sheet.open}
        onReturn={() => setOpenDialog("return")}
        exchangeAvailable={exchangeAvailable}
        exchangeLabel={props.returnLabels.exchangeOpen}
        onExchange={() => setOpenDialog("exchange")}
        onShip={() => setOpenDialog("ship")}
        onFailAttempt={() => setOpenDialog("failAttempt")}
        onReship={() => setOpenDialog("reship")}
        onRts={() => setOpenDialog("rts")}
        onReconcileLoss={() => setOpenDialog("reconcileLoss")}
        onRecoverLoss={() => setOpenDialog("recoverLoss")}
      />
      <OrderPaymentSection
        order={order}
        remainingDueMinor={props.remainingDueMinor}
        currency={props.currency}
        locale={props.locale}
        labels={labels}
        showPayButton={permissions.canReceive && hasDue}
        onReceivePayment={() => setOpenDialog("pay")}
      />
      <DeliveryAttemptsCard attempts={props.deliveryAttempts ?? []} labels={labels} />
      <OrderDetailSheets
        {...props}
        openDialog={openDialog}
        setOpenDialog={setOpenDialog}
        canEdit={flags.canEdit}
        reportFailure={actions.reportFailure}
        onConfirmDelete={() => void actions.remove()}
      />
      {actions.approval.isOpen ? (
        <LazyOrderApprovalDialog flow={actions.approval} labels={labels.approval} />
      ) : null}
    </>
  );
}
