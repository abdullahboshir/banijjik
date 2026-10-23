"use client";

import type { CreditPurchaseResponse } from "@banijjik/contracts/credit";
import { ApprovalPinDialog, Button, Sheet, SheetContent, type DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fillLabel } from "../catalog/catalog-labels";
import { PurchaseInfo, RejectForm } from "./credit-purchase-detail-info";
import type { CreditPurchaseLabels } from "./credit-purchase-labels";
import { usePurchaseActions } from "./use-purchase-actions";
import type { PurchaseApproval } from "./use-purchase-approval";

export interface CreditPurchaseDetailSheetProps {
  purchase: CreditPurchaseResponse | undefined;
  organizationId: string;
  canVerify: boolean;
  isOwner: boolean;
  locations: readonly { locationId: string; name: string }[];
  locale: DisplayLocale;
  labels: CreditPurchaseLabels;
  onClose: () => void;
  onUpdated: () => void;
}

function PurchaseDecisionSection(props: {
  purchase: CreditPurchaseResponse;
  canVerify: boolean;
  rejecting: boolean;
  rejectReason: string;
  isBusy: boolean;
  labels: CreditPurchaseLabels;
  onRejectReasonChange: (reason: string) => void;
  onRejectSubmit: () => void;
  onCancelReject: () => void;
  onStartReject: () => void;
  onVerify: () => void;
}): ReactElement | null {
  const { purchase, canVerify, rejecting, rejectReason, isBusy, labels } = props;
  if (purchase.status !== "PENDING" || !canVerify) return null;

  if (rejecting) {
    return (
      <RejectForm
        reason={rejectReason}
        isBusy={isBusy}
        labels={labels}
        onReasonChange={props.onRejectReasonChange}
        onSubmit={props.onRejectSubmit}
        onCancel={props.onCancelReject}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={props.onVerify} isLoading={isBusy}>
        {labels.verify}
      </Button>
      <Button variant="secondary" onClick={props.onStartReject}>
        {labels.reject}
      </Button>
    </div>
  );
}

function PurchaseApprovalDialog(props: {
  approval: PurchaseApproval;
  labels: CreditPurchaseLabels["approval"];
}): ReactElement | null {
  const { approval, labels } = props;
  if (!approval.pendingPurchase) return null;

  return (
    <ApprovalPinDialog
      open
      onOpenChange={(open) => {
        if (!open) approval.close();
      }}
      title={labels.title}
      approverLabel={labels.approver}
      pinLabel={labels.pin}
      submitLabel={labels.submit}
      cancelLabel={labels.cancel}
      closeLabel={labels.close}
      lockedMessage={labels.locked}
      approvers={approval.approvers}
      isSubmitting={approval.isGranting}
      isLocked={approval.isLocked}
      {...(approval.errorMessage === undefined ? {} : { errorMessage: approval.errorMessage })}
      onSubmit={(input) => void approval.approve(input)}
    />
  );
}

export function CreditPurchaseDetailSheet(
  props: CreditPurchaseDetailSheetProps,
): ReactElement | null {
  const { purchase, canVerify, locale, labels, onClose } = props;
  const actions = usePurchaseActions({
    purchase,
    organizationId: props.organizationId,
    isOwner: props.isOwner,
    locations: props.locations,
    labels,
    onUpdated: props.onUpdated,
  });

  if (!purchase) return null;
  const title = fillLabel(labels.detail.title, { number: purchase.purchaseNumber });

  return (
    <>
      <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
        <SheetContent title={title} closeLabel={labels.detail.close}>
          <div className="flex flex-col gap-4">
            <PurchaseInfo purchase={purchase} locale={locale} labels={labels} />

            {actions.errorMessage ? (
              <p role="alert" className="text-small text-danger">
                {actions.errorMessage}
              </p>
            ) : null}

            <PurchaseDecisionSection
              purchase={purchase}
              canVerify={canVerify}
              rejecting={actions.rejecting}
              rejectReason={actions.rejectReason}
              isBusy={actions.isBusy}
              labels={labels}
              onRejectReasonChange={actions.setRejectReason}
              onRejectSubmit={() => void actions.handleReject()}
              onCancelReject={() => actions.setRejecting(false)}
              onStartReject={() => actions.setRejecting(true)}
              onVerify={() => void actions.handleVerify()}
            />
          </div>
        </SheetContent>
      </Sheet>

      <PurchaseApprovalDialog approval={actions.approval} labels={labels.approval} />
    </>
  );
}
