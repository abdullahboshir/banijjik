"use client";

import { ConfirmDialog } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { OrderLabels } from "./order-labels";

export interface OrderDeleteDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly labels: OrderLabels;
  readonly onConfirm: () => void;
}

/** Asks before a draft is deleted for good. */
export function OrderDeleteDialog(props: OrderDeleteDialogProps): ReactElement {
  const { labels } = props;
  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={labels.actions.deleteDraft}
      description={labels.detail.deleteDescription}
      confirmLabel={labels.actions.deleteDraft}
      cancelLabel={labels.cancelDialog.keep}
      closeLabel={labels.actions.close}
      tone="danger"
      onConfirm={props.onConfirm}
    />
  );
}
