"use client";

import type { ReactElement } from "react";
import { Button } from "./button.js";
import { Dialog, DialogContent } from "./dialog.js";
import { MoneyText, type MoneyTextProps } from "./money-text.js";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Shown prominently: destructive and money actions always show the amount (13-UX principle 6). */
  amount?: MoneyTextProps;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  tone: "default" | "danger";
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  amount,
  confirmLabel,
  cancelLabel,
  closeLabel,
  tone,
  onConfirm,
}: ConfirmDialogProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} closeLabel={closeLabel}>
        {amount ? (
          <p className="text-display font-semibold text-primary">
            <MoneyText {...amount} />
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
