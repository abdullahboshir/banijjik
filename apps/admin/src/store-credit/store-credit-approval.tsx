"use client";
import type { ReactElement } from "react";

import { ApprovalPinDialog } from "@banijjik/ui";
import type { StoreCreditLabels } from "./store-credit-labels";
import type { useStoreCreditAdjustment } from "./use-store-credit-adjustment";

export function StoreCreditApproval(props: {
  labels: StoreCreditLabels;
  adjustment: ReturnType<typeof useStoreCreditAdjustment>;
}): ReactElement {
  const { adjustment, labels } = props;
  return (
    <ApprovalPinDialog
      open
      onOpenChange={(open) => {
        if (!open) adjustment.close();
      }}
      title={labels.approval.title}
      approverLabel={labels.approval.approver}
      pinLabel={labels.approval.pin}
      submitLabel={labels.approval.submit}
      cancelLabel={labels.approval.cancel}
      closeLabel={labels.approval.close}
      lockedMessage={labels.approval.locked}
      approvers={adjustment.approvers}
      isSubmitting={adjustment.busy}
      isLocked={adjustment.locked}
      {...(adjustment.error ? { errorMessage: adjustment.error } : {})}
      onSubmit={(input) => void adjustment.approve(input)}
    />
  );
}
