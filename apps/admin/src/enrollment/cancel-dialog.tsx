"use client";

import { ConfirmDialog } from "@banijjik/ui";
import type { ReactElement } from "react";

export interface CancelDialogProps {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly keepLabel: string;
  readonly closeLabel: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

/** Loaded on the first tap of Cancel, so the dialog code stays out of the detail route's first load. */
export function CancelDialog(props: CancelDialogProps): ReactElement {
  return (
    <ConfirmDialog
      open
      onOpenChange={props.onOpenChange}
      title={props.title}
      description={props.description}
      confirmLabel={props.confirmLabel}
      cancelLabel={props.keepLabel}
      closeLabel={props.closeLabel}
      tone="danger"
      onConfirm={props.onConfirm}
    />
  );
}
