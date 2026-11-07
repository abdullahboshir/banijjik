"use client";

import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import type { OrderDetailClientProps, DialogKey } from "./order-detail-client";
import type { OrderLabels } from "./order-labels";
import { LazyExchangeSheet } from "./lazy-exchange-sheet";
import { LazyOrderCancelSheet } from "./lazy-order-cancel-sheet";
import { LazyOrderDeleteDialog } from "./lazy-order-delete-dialog";
import { LazyOrderEditSheet } from "./lazy-order-edit-sheet";
import { LazyReturnSheet } from "./lazy-return-sheet";
import { OrderPaySheet } from "./order-pay-sheet";
import { FulfillmentSlots } from "./fulfillment/fulfillment-slots";

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

export interface OrderDetailSheetsProps extends OrderDetailClientProps {
  readonly openDialog: DialogKey | undefined;
  readonly setOpenDialog: (key: DialogKey | undefined) => void;
  readonly canEdit: boolean;
  readonly reportFailure: (error: unknown) => void;
  readonly onConfirmDelete: () => void;
}

export function OrderDetailSheets(props: OrderDetailSheetsProps): ReactElement {
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
      <FulfillmentSlots props={props} openDialog={openDialog} toggle={toggle} />
    </>
  );
}
