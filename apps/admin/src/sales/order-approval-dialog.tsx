"use client";

import { ApprovalPinDialog } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { OrderApprovalFlow } from "./order-approval";
import type { OrderApprovalLabels } from "./order-labels";

export interface OrderApprovalDialogProps {
  readonly flow: OrderApprovalFlow;
  readonly labels: OrderApprovalLabels;
}

/** The manager PIN sheet; the flow owns the approver list and the retried action. */
export function OrderApprovalDialog(props: OrderApprovalDialogProps): ReactElement | null {
  // Mounted only once the approver list is known: the PIN sheet picks its first approver on mount.
  if (!props.flow.isOpen || props.flow.approvers.length === 0) return null;
  return (
    <ApprovalPinDialog
      key={props.flow.approvers[0]?.memberId ?? "approval"}
      open={props.flow.isOpen}
      onOpenChange={(open) => (open ? undefined : props.flow.close())}
      title={props.labels.title}
      approverLabel={props.labels.approver}
      pinLabel={props.labels.pin}
      submitLabel={props.labels.submit}
      cancelLabel={props.labels.cancel}
      closeLabel={props.labels.close}
      lockedMessage={props.labels.locked}
      approvers={props.flow.approvers.map((approver) => ({
        memberId: approver.memberId,
        displayName: approver.displayName,
        hasPin: true,
      }))}
      {...(props.flow.errorMessage === undefined ? {} : { errorMessage: props.flow.errorMessage })}
      isLocked={props.flow.isLocked}
      isSubmitting={props.flow.isApproving}
      onSubmit={(input) => void props.flow.submitPin(input)}
    />
  );
}
