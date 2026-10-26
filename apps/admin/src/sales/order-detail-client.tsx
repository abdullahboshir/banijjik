"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { ModifierGroupResponse } from "@banijjik/contracts/catalog";
import type { PaymentMethod } from "@banijjik/contracts/payment";
import type { OrderResponse } from "@banijjik/contracts/sales";
import type { DisplayLocale } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { PaymentLabels } from "../payments/payment-labels";
import { LazyOrderApprovalDialog } from "./lazy-order-approval-dialog";
import { LazyOrderCancelSheet } from "./lazy-order-cancel-sheet";
import { LazyOrderDeleteDialog } from "./lazy-order-delete-dialog";
import { LazyOrderEditSheet } from "./lazy-order-edit-sheet";
import { canOfferExchange } from "./exchange-model";
import { LazyExchangeSheet } from "./lazy-exchange-sheet";
import { LazyReturnSheet } from "./lazy-return-sheet";
import type { ReturnLabels } from "./return-labels";
import { OrderActionBar } from "./order-action-bar";
import { orderActionFlagsOf, type OrderDetailPermissions } from "./order-action-flags";
import type { OrderLabels } from "./order-labels";
import { OrderPaySheet } from "./order-pay-sheet";
import { OrderPaymentSection } from "./order-payment-section";
import { canOfferReturn } from "./return-model";
import { useOrderActions } from "./use-order-actions";

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
}

type DialogKey = "cancel" | "delete" | "edit" | "pay" | "return" | "exchange";

/** The cancel sheet of an order; the paid amount note and the contact way out live inside it. */
function OrderCancelSlot(props: {
  readonly props: OrderDetailClientProps & {
    readonly canEdit: boolean;
    readonly reportFailure: (error: unknown) => void;
  };
  readonly onOpenChange: (open: boolean) => void;
  readonly onPickContact: () => void;
}): ReactElement {
  const { props: detail } = props;
  return (
    <LazyOrderCancelSheet
      open
      onOpenChange={props.onOpenChange}
      organizationId={detail.organizationId}
      order={detail.order}
      hasNetPaid={detail.hasNetPaid}
      canEdit={detail.canEdit}
      labels={detail.labels}
      onPickContact={props.onPickContact}
      onFailure={detail.reportFailure}
    />
  );
}

/** The return sheet of a completed order (plan 3.5b card B), loaded when the staff member opens it. */
function OrderReturnSheetSlot(props: {
  readonly props: OrderDetailClientProps;
  readonly onOpenChange: (open: boolean) => void;
}): ReactElement {
  const { props: detail } = props;
  return (
    <LazyReturnSheet
      open
      onOpenChange={props.onOpenChange}
      orgSlug={detail.orgSlug}
      organizationId={detail.organizationId}
      order={detail.order}
      allowedMethods={detail.allowedMethods}
      methodLabels={detail.paymentLabels.method}
      locale={detail.locale}
      labels={detail.returnLabels}
      approvalLabels={detail.labels.approval}
    />
  );
}

/** The exchange sheet of a completed order with a customer (plan 3.5b B2), loaded when the staff member opens it. */
function OrderExchangeSheetSlot(props: {
  readonly props: OrderDetailClientProps;
  readonly onOpenChange: (open: boolean) => void;
}): ReactElement {
  const { props: detail } = props;
  return (
    <LazyExchangeSheet
      open
      onOpenChange={props.onOpenChange}
      orgSlug={detail.orgSlug}
      organizationId={detail.organizationId}
      order={detail.order}
      allowedMethods={detail.allowedMethods}
      methodLabels={detail.paymentLabels.method}
      locale={detail.locale}
      currency={detail.currency}
      labels={detail.returnLabels}
      orderLabels={detail.labels}
      modifierGroups={detail.modifierGroups}
      unitLabels={detail.unitLabels}
      performersEnabled={detail.performersEnabled}
    />
  );
}

/** The receive-payment sheet; a payment taken closes it and reloads the order. */
function OrderPaySlot(props: {
  readonly props: OrderDetailClientProps;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}): ReactElement {
  const router = useRouter();
  const { props: detail } = props;
  return (
    <OrderPaySheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      organizationId={detail.organizationId}
      order={detail.order}
      locationName={detail.locationName}
      remainingDueMinor={detail.remainingDueMinor}
      currency={detail.currency}
      currencySymbol={detail.currencySymbol}
      allowedMethods={detail.allowedMethods}
      paymentLabels={detail.paymentLabels}
      onPaid={() => {
        props.onOpenChange(false);
        router.refresh();
      }}
    />
  );
}

/** The edit sheet of a draft or an open order; a save reloads the order. */
function OrderEditSlot(props: {
  readonly props: OrderDetailClientProps;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}): ReactElement {
  const router = useRouter();
  const { props: detail } = props;
  return (
    <LazyOrderEditSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      organizationId={detail.organizationId}
      order={detail.order}
      contactName={detail.contactName}
      modifierGroups={detail.modifierGroups}
      unitLabels={detail.unitLabels}
      currency={detail.currency}
      locale={detail.locale}
      labels={detail.labels}
      performersEnabled={detail.performersEnabled}
      onSaved={() => router.refresh()}
    />
  );
}

function OrderDetailSheets(
  props: OrderDetailClientProps & {
    readonly openDialog: DialogKey | undefined;
    readonly setOpenDialog: (key: DialogKey | undefined) => void;
    readonly canEdit: boolean;
    readonly reportFailure: (error: unknown) => void;
    readonly onConfirmDelete: () => void;
  },
): ReactElement {
  const { labels, openDialog, setOpenDialog } = props;
  const toggle = (key: DialogKey) => (open: boolean) => setOpenDialog(open ? key : undefined);
  return (
    <>
      {openDialog === "delete" ? (
        <OrderDeleteSlot
          labels={labels}
          onClose={() => setOpenDialog(undefined)}
          onConfirm={props.onConfirmDelete}
        />
      ) : null}
      {openDialog === "cancel" ? (
        <OrderCancelSlot
          props={props}
          onOpenChange={toggle("cancel")}
          onPickContact={() => setOpenDialog("edit")}
        />
      ) : null}
      <OrderPaySlot props={props} open={openDialog === "pay"} onOpenChange={toggle("pay")} />
      {openDialog === "return" ? (
        <OrderReturnSheetSlot props={props} onOpenChange={toggle("return")} />
      ) : null}
      {openDialog === "exchange" ? (
        <OrderExchangeSheetSlot props={props} onOpenChange={toggle("exchange")} />
      ) : null}
      <OrderEditSlot props={props} open={openDialog === "edit"} onOpenChange={toggle("edit")} />
    </>
  );
}

/** The delete confirmation of a draft; confirming closes it and removes the draft. */
function OrderDeleteSlot(props: {
  readonly labels: OrderLabels;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}): ReactElement {
  return (
    <LazyOrderDeleteDialog
      open
      onOpenChange={(open) => (open ? undefined : props.onClose())}
      labels={props.labels}
      onConfirm={() => {
        props.onClose();
        props.onConfirm();
      }}
    />
  );
}

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
  const flags = orderActionFlagsOf(order.status, permissions, props.usePacking);
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
