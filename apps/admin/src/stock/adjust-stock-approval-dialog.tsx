"use client";

import { ApprovalPinDialog } from "@banijjik/ui";
import type { ReactElement } from "react";
import { listApprovers } from "./stock-api";
import type { AdjustStockLabels } from "./stock-labels";

export function AdjustStockApprovalDialog(props: {
  labels: AdjustStockLabels;
  pinOpen: boolean;
  setPinOpen: (open: boolean) => void;
  approvers: Awaited<ReturnType<typeof listApprovers>>;
  isGranting: boolean;
  approvalError: string | undefined;
  onApproval: (input: { approverMemberId: string; pin: string }) => Promise<void>;
}): ReactElement {
  return (
    <ApprovalPinDialog
      open={props.pinOpen}
      onOpenChange={props.setPinOpen}
      title={props.labels.approvalTitle}
      approverLabel={props.labels.approvalApprover}
      pinLabel={props.labels.approvalPin}
      submitLabel={props.labels.approvalSubmit}
      cancelLabel={props.labels.approvalCancel}
      closeLabel={props.labels.approvalClose}
      lockedMessage={props.labels.approvalLocked}
      approvers={props.approvers}
      isSubmitting={props.isGranting}
      isLocked={props.approvalError === "errors.approval_pin_locked"}
      {...(props.approvalError === undefined ? {} : { errorMessage: props.approvalError })}
      onSubmit={(input) => void props.onApproval(input)}
    />
  );
}
