"use client";

import type { OrderResponse } from "@banijjik/contracts/sales";
import { Button, FormField, Select, Sheet, SheetContent, Textarea } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { OrderLabels } from "../order-labels";
import { showSuccessToast } from "../order-toast";
import { receiveRts } from "./fulfillment-api";

export interface OrderRtsSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly labels: OrderLabels;
}

export function OrderRtsSheet(props: OrderRtsSheetProps): ReactElement | null {
  const { open, onOpenChange, organizationId, order, labels } = props;
  const router = useRouter();

  const [disposition, setDisposition] = useState<"RESTOCK" | "RETURN_DAMAGED">("RESTOCK");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(undefined);
    try {
      await receiveRts(organizationId, order.orderId, {
        version: order.version,
        restockDisposition: disposition,
        note: note.trim() || undefined,
      });
      showSuccessToast(labels.rts.success);
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
        title={labels.rts.title}
        closeLabel={labels.actions.close}
      >
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">{labels.rts.description}</p>

          <FormField label={labels.rts.disposition} htmlFor="rts-disposition" required>
            <Select
              id="rts-disposition"
              value={disposition}
              disabled={isSaving}
              onChange={(e) => {
                setDisposition(e.target.value as "RESTOCK" | "RETURN_DAMAGED");
                setError(undefined);
              }}
            >
              <option value="RESTOCK">{labels.rts.restock}</option>
              <option value="RETURN_DAMAGED">{labels.rts.damaged}</option>
            </Select>
          </FormField>

          <FormField
            label={labels.rts.reason}
            htmlFor="rts-note"
            {...(error !== undefined ? { error } : {})}
          >
            <Textarea
              id="rts-note"
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
              {labels.rts.submit}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
