"use client";

import {
  COURIER_SETTLEMENT_RECEIVED_VIA,
  MANUAL_COURIER_KEY,
  type CourierSettlementReceivedVia,
  type ManualCourierKey,
} from "@banijjik/contracts/courier";
import { Button, FormField, Select, Sheet, SheetContent, TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { recordCourierSettlement } from "./courier-api";
import { showSuccessToast } from "./courier-toast";
import type { CourierLabels } from "./courier-types";

export interface CourierSettlementSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly labels: CourierLabels;
}

export function CourierSettlementSheet({
  open,
  onOpenChange,
  organizationId,
  labels,
}: CourierSettlementSheetProps): ReactElement {
  const router = useRouter();
  const [courierKey, setCourierKey] = useState<ManualCourierKey>("STEADFAST");
  const [reference, setReference] = useState("");
  const [chargesMinor, setChargesMinor] = useState("0");
  const [receivedVia, setReceivedVia] = useState<CourierSettlementReceivedVia>("BANK");
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentIdsText, setPaymentIdsText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = async (): Promise<void> => {
    const rawIds = paymentIdsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (rawIds.length === 0) {
      setError(labels.settlement.paymentsPlaceholder);
      return;
    }
    if (!reference.trim()) {
      setError(labels.settlement.referencePlaceholder);
      return;
    }

    const charges = Math.max(0, Math.round(Number(chargesMinor) * 100)) || 0;

    setIsSaving(true);
    setError(undefined);
    try {
      await recordCourierSettlement(organizationId, {
        courierKey,
        externalReference: reference.trim(),
        courierChargesMinor: charges,
        receivedVia,
        businessDate,
        paymentIds: rawIds,
      });
      showSuccessToast(labels.settlement.success);
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
        title={labels.settlement.title}
        closeLabel={labels.close}
      >
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">{labels.settlement.description}</p>

          <FormField label={labels.settlement.courier} htmlFor="courier-key" required>
            <Select
              id="courier-key"
              value={courierKey}
              disabled={isSaving}
              onChange={(e) => setCourierKey(e.target.value as ManualCourierKey)}
            >
              {Object.values(MANUAL_COURIER_KEY).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label={labels.settlement.reference} htmlFor="settlement-ref" required>
            <TextInput
              id="settlement-ref"
              value={reference}
              disabled={isSaving}
              placeholder={labels.settlement.referencePlaceholder}
              onChange={(e) => {
                setReference(e.target.value);
                setError(undefined);
              }}
            />
          </FormField>

          <FormField label={labels.settlement.charges} htmlFor="settlement-charges" required>
            <TextInput
              id="settlement-charges"
              type="number"
              value={chargesMinor}
              disabled={isSaving}
              placeholder={labels.settlement.chargesPlaceholder}
              onChange={(e) => setChargesMinor(e.target.value)}
            />
          </FormField>

          <FormField label={labels.settlement.receivedVia} htmlFor="settlement-via" required>
            <Select
              id="settlement-via"
              value={receivedVia}
              disabled={isSaving}
              onChange={(e) => setReceivedVia(e.target.value as CourierSettlementReceivedVia)}
            >
              {Object.values(COURIER_SETTLEMENT_RECEIVED_VIA).map((via) => (
                <option key={via} value={via}>
                  {via}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label={labels.settlement.businessDate} htmlFor="settlement-date" required>
            <TextInput
              id="settlement-date"
              type="date"
              value={businessDate}
              disabled={isSaving}
              onChange={(e) => setBusinessDate(e.target.value)}
            />
          </FormField>

          <FormField label={labels.settlement.payments} htmlFor="settlement-payments" required>
            <textarea
              id="settlement-payments"
              className="border rounded p-2 text-sm font-mono min-h-[100px]"
              value={paymentIdsText}
              disabled={isSaving}
              placeholder={labels.settlement.paymentsPlaceholder}
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
              {isSaving ? "..." : labels.settlement.submit}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
