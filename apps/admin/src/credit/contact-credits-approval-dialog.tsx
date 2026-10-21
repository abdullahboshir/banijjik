"use client";

import { ApprovalPinDialog } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { ContactCreditsLabels } from "./credit-labels";
import type { CreditApproval } from "./use-credit-approval";

/** Mounted only while an adjustment waits for a PIN, so the dialog starts with the listed approvers. */
export function ContactCreditsApprovalDialog(props: {
  labels: ContactCreditsLabels;
  approval: CreditApproval;
}): ReactElement | null {
  if (props.approval.pending === undefined) return null;
  const { labels, approval } = props;
  return (
    <ApprovalPinDialog
      open
      onOpenChange={(open) => {
        if (!open) approval.close();
      }}
      title={labels.approval.title}
      approverLabel={labels.approval.approver}
      pinLabel={labels.approval.pin}
      submitLabel={labels.approval.submit}
      cancelLabel={labels.approval.cancel}
      closeLabel={labels.approval.close}
      lockedMessage={labels.approval.locked}
      approvers={approval.approvers}
      isSubmitting={approval.isGranting}
      isLocked={approval.isLocked}
      {...(approval.errorMessage === undefined ? {} : { errorMessage: approval.errorMessage })}
      onSubmit={(input) => void approval.approve(input)}
    />
  );
}
