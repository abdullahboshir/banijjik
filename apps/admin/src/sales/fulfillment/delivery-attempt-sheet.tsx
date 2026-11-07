"use client";

import {
  SALES_DELIVERY_FAIL_REASON,
  type DeliveryFailReasonKey,
} from "@banijjik/contracts/sales/delivery";
import type { OrderResponse } from "@banijjik/contracts/sales";
import { Button, FormField, Select, Sheet, SheetContent, Textarea } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { OrderLabels } from "../order-labels";
import { showSuccessToast } from "../order-toast";
import { recordDeliveryAttempt } from "./fulfillment-api";

export interface DeliveryAttemptSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly labels: OrderLabels;
}

export function DeliveryAttemptSheet(props: DeliveryAttemptSheetProps): ReactElement | null {
  const { open, onOpenChange, organizationId, order, labels } = props;
  const router = useRouter();

  const [reasonKey, setReasonKey] = useState<DeliveryFailReasonKey>(
    SALES_DELIVERY_FAIL_REASON.RECIPIENT_UNAVAILABLE,
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (reasonKey === "OTHER" && !note.trim()) {
      setError(labels.attempt.notePlaceholder);
      return;
    }

    setIsSaving(true);
    setError(undefined);
    try {
      await recordDeliveryAttempt(organizationId, order.orderId, {
        version: order.version,
        reasonKey,
        note: note.trim() || undefined,
      });
      showSuccessToast(labels.attempt.success);
      onOpenChange(false);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={labels.attempt.title}
        closeLabel={labels.actions.close}
      >
        <div className="flex flex-col gap-4">
          <FormField label={labels.attempt.reason} htmlFor="attempt-reason" required>
            <Select
              id="attempt-reason"
              value={reasonKey}
              disabled={isSaving}
              onChange={(e) => {
                setReasonKey(e.target.value as DeliveryFailReasonKey);
                setError(undefined);
              }}
            >
              <option value="RECIPIENT_UNAVAILABLE">
                {labels.attempt.reasons.customerUnreachable}
              </option>
              <option value="ADDRESS_INVALID">
                {labels.attempt.reasons.incorrectAddress}
              </option>
              <option value="REFUSED">
                {labels.attempt.reasons.cashNotReady}
              </option>
              <option value="OTHER">
                {labels.attempt.reasons.other}
              </option>
            </Select>
          </FormField>

          <FormField
            label={labels.attempt.note}
            htmlFor="attempt-note"
            required={reasonKey === "OTHER"}
            {...(error !== undefined ? { error } : {})}
          >
            <Textarea
              id="attempt-note"
              value={note}
              disabled={isSaving}
              placeholder={labels.attempt.notePlaceholder}
              onChange={(e) => {
                setNote(e.target.value);
                setError(undefined);
              }}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              {labels.actions.close}
            </Button>
            <Button isLoading={isSaving} onClick={() => void handleSubmit()}>
              {labels.attempt.submit}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
