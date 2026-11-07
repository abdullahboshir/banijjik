"use client";

import {
  RIDER_HANDOVER_RECEIVED_VIA,
  type RiderHandoverReceivedVia,
} from "@banijjik/contracts/delivery";
import { Button, FormField, Select, Sheet, SheetContent, TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { recordRiderCashHandover } from "./delivery-api";
import { showSuccessToast } from "./delivery-toast";
import type { DeliveryLabels } from "./delivery-types";

export interface RiderHandoverSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly labels: DeliveryLabels;
}

export function RiderHandoverSheet({
  open,
  onOpenChange,
  organizationId,
  labels,
}: RiderHandoverSheetProps): ReactElement {
  const router = useRouter();
  const [riderMemberId, setRiderMemberId] = useState("");
  const [receivedVia, setReceivedVia] = useState<RiderHandoverReceivedVia>("CASH");
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [posSessionId, setPosSessionId] = useState("");
  const [paymentIdsText, setPaymentIdsText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = async (): Promise<void> => {
    const rawIds = paymentIdsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!riderMemberId.trim()) {
      setError("Rider member ID is required");
      return;
    }
    if (rawIds.length === 0) {
      setError(labels.handover.paymentsPlaceholder);
      return;
    }

    setIsSaving(true);
    setError(undefined);
    try {
      await recordRiderCashHandover(organizationId, {
        riderMemberId: riderMemberId.trim(),
        paymentIds: rawIds,
        receivedVia,
        businessDate,
        ...(posSessionId.trim() ? { posSessionId: posSessionId.trim() } : {}),
      });
      showSuccessToast(labels.handover.success);
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
        title={labels.handover.title}
        closeLabel={labels.close}
      >
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">{labels.handover.description}</p>

          <FormField label={labels.handover.rider} htmlFor="rider-id" required>
            <TextInput
              id="rider-id"
              value={riderMemberId}
              disabled={isSaving}
              placeholder="Enter rider member ID"
              onChange={(e) => {
                setRiderMemberId(e.target.value);
                setError(undefined);
              }}
            />
          </FormField>

          <FormField label={labels.handover.receivedVia} htmlFor="handover-via" required>
            <Select
              id="handover-via"
              value={receivedVia}
              disabled={isSaving}
              onChange={(e) => setReceivedVia(e.target.value as RiderHandoverReceivedVia)}
            >
              {Object.values(RIDER_HANDOVER_RECEIVED_VIA).map((via) => (
                <option key={via} value={via}>
                  {via}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label={labels.handover.businessDate} htmlFor="handover-date" required>
            <TextInput
              id="handover-date"
              type="date"
              value={businessDate}
              disabled={isSaving}
              onChange={(e) => setBusinessDate(e.target.value)}
            />
          </FormField>

          <FormField label={labels.handover.posSessionId} htmlFor="handover-pos">
            <TextInput
              id="handover-pos"
              value={posSessionId}
              disabled={isSaving}
              placeholder={labels.handover.posSessionPlaceholder}
              onChange={(e) => setPosSessionId(e.target.value)}
            />
          </FormField>

          <FormField label={labels.handover.payments} htmlFor="handover-payments" required>
            <textarea
              id="handover-payments"
              className="border rounded p-2 text-sm font-mono min-h-[100px]"
              value={paymentIdsText}
              disabled={isSaving}
              placeholder={labels.handover.paymentsPlaceholder}
              onChange={(e) => {
                setPaymentIdsText(e.target.value);
                setError(undefined);
              }}
            />
          </FormField>

          {error ? <div className="text-danger text-sm">{error}</div> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" disabled={isSaving} onClick={() => onOpenChange(false)}>
              {labels.close}
            </Button>
            <Button variant="primary" disabled={isSaving} onClick={handleSubmit}>
              {isSaving ? "..." : labels.handover.submit}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
