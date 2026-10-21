"use client";

import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";

export function BookingDetailCancelPanel(props: {
  cancelReason: string;
  cancelReasonLabel: string;
  cancelLabel: string;
  isSaving: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
}): ReactElement {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-default p-3">
      <label className="flex flex-col gap-1">
        <span className="text-small text-secondary">{props.cancelReasonLabel}</span>
        <textarea
          className="min-h-20 rounded-sm border border-default bg-surface px-3 py-2 text-body"
          value={props.cancelReason}
          onChange={(event) => props.onReasonChange(event.target.value)}
        />
      </label>
      <Button type="button" variant="secondary" isLoading={props.isSaving} onClick={props.onCancel}>
        {props.cancelLabel}
      </Button>
    </div>
  );
}
