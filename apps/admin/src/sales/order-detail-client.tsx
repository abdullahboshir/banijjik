"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { ModifierGroupResponse } from "@banijjik/contracts/catalog";
import type { PaymentMethod } from "@banijjik/contracts/payment";
import type { OrderResponse } from "@banijjik/contracts/sales";
import { ConfirmDialog, type DisplayLocale } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { PaymentLabels } from "../payments/payment-labels";
import { LazyOrderEditSheet } from "./lazy-order-edit-sheet";
import { OrderActionBar } from "./order-action-bar";
import { orderActionFlagsOf, type OrderDetailPermissions } from "./order-action-flags";
import { OrderApprovalDialog } from "./order-approval";
import { OrderCancelSheet } from "./order-cancel-sheet";
import type { OrderLabels } from "./order-labels";
import { OrderPaySheet } from "./order-pay-sheet";
import { OrderPaymentSection } from "./order-payment-section";
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
}

type DialogKey = "cancel" | "delete" | "edit" | "pay";

function OrderDetailSheets(
  props: OrderDetailClientProps & {
    readonly openDialog: DialogKey | undefined;
    readonly setOpenDialog: (key: DialogKey | undefined) => void;
    readonly canEdit: boolean;
    readonly reportFailure: (error: unknown) => void;
  },
): ReactElement {
  const router = useRouter();
  const { order, labels, openDialog, setOpenDialog } = props;
  const toggle = (key: DialogKey) => (open: boolean) => setOpenDialog(open ? key : undefined);
  return (
    <>
      <OrderCancelSheet
        open={openDialog === "cancel"}
        onOpenChange={toggle("cancel")}
        organizationId={props.organizationId}
        order={order}
        hasNetPaid={props.hasNetPaid}
        canEdit={props.canEdit}
        labels={labels}
        onPickContact={() => setOpenDialog("edit")}
        onFailure={props.reportFailure}
      />
      <OrderPaySheet
        open={openDialog === "pay"}
        onOpenChange={toggle("pay")}
        organizationId={props.organizationId}
        order={order}
        locationName={props.locationName}
        remainingDueMinor={props.remainingDueMinor}
        currency={props.currency}
        currencySymbol={props.currencySymbol}
        allowedMethods={props.allowedMethods}
        paymentLabels={props.paymentLabels}
        onPaid={() => {
          setOpenDialog(undefined);
          router.refresh();
        }}
      />
      <LazyOrderEditSheet
        open={openDialog === "edit"}
        onOpenChange={toggle("edit")}
        organizationId={props.organizationId}
        order={order}
        contactName={props.contactName}
        modifierGroups={props.modifierGroups}
        unitLabels={props.unitLabels}
        currency={props.currency}
        locale={props.locale}
        labels={labels}
        onSaved={() => router.refresh()}
      />
    </>
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
      <ConfirmDialog
        open={openDialog === "delete"}
        onOpenChange={(open) => setOpenDialog(open ? "delete" : undefined)}
        title={labels.actions.deleteDraft}
        description={labels.detail.deleteDescription}
        confirmLabel={labels.actions.deleteDraft}
        cancelLabel={labels.cancelDialog.keep}
        closeLabel={labels.actions.close}
        tone="danger"
        onConfirm={() => {
          setOpenDialog(undefined);
          void actions.remove();
        }}
      />
      <OrderDetailSheets
        {...props}
        openDialog={openDialog}
        setOpenDialog={setOpenDialog}
        canEdit={flags.canEdit}
        reportFailure={actions.reportFailure}
      />
      <OrderApprovalDialog flow={actions.approval} labels={labels.approval} />
    </>
  );
}
