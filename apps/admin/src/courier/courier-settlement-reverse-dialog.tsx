"use client";

import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { Button, FormField, Sheet, SheetContent, TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { grantApproval } from "../payments/payment-api";
import { reverseCourierSettlement } from "./courier-api";
import { showSuccessToast } from "./courier-toast";
import type { CourierLabels } from "./courier-types";

export interface CourierSettlementReverseDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly locationId: string;
  readonly courierSettlementId: string;
  readonly version: number;
  readonly labels: CourierLabels;
}

export function CourierSettlementReverseDialog({
  open,
  onOpenChange,
  organizationId,
  locationId,
  courierSettlementId,
  version,
  labels,
}: CourierSettlementReverseDialogProps): ReactElement {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [approverMemberId, setApproverMemberId] = useState("");
  const [pin, setPin] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = async (): Promise<void> => {
    if (!reason.trim()) {
      setError(labels.reverse.reasonPlaceholder);
      return;
    }
    if (!approverMemberId.trim() || !pin.trim()) {
      setError("Approver Member ID and PIN are required.");
      return;
    }

    setIsSaving(true);
    setError(undefined);
    try {
      const grant = await grantApproval(organizationId, {
        action: APPROVAL_ACTION.COURIER_SETTLEMENT_REVERSAL,
        subjectKey: courierSettlementId,
        locationId,
        approverMemberId: approverMemberId.trim(),
        pin: pin.trim(),
      });

      await reverseCourierSettlement(organizationId, courierSettlementId, {
        version,
        reason: reason.trim(),
        approvalToken: grant.approvalToken,
      });

      showSuccessToast(labels.reverse.success);
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
        title={labels.reverse.title}
        closeLabel={labels.close}
      >
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">{labels.reverse.description}</p>

          <FormField label={labels.reverse.reason} htmlFor="reverse-reason" required>
            <TextInput
              id="reverse-reason"
              value={reason}
              disabled={isSaving}
              placeholder={labels.reverse.reasonPlaceholder}
              onChange={(e) => {
                setReason(e.target.value);
                setError(undefined);
              }}
            />
          </FormField>

          <FormField label="Approver Member ID" htmlFor="reverse-approver" required>
            <TextInput
              id="reverse-approver"
              value={approverMemberId}
              disabled={isSaving}
              placeholder="Enter approver member ID"
              onChange={(e) => setApproverMemberId(e.target.value)}
            />
          </FormField>

          <FormField label="Approver PIN" htmlFor="reverse-pin" required>
            <TextInput
              id="reverse-pin"
              type="password"
              value={pin}
              disabled={isSaving}
              placeholder="••••"
              onChange={(e) => setPin(e.target.value)}
            />
          </FormField>

          {error ? <div className="text-danger text-sm">{error}</div> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" disabled={isSaving} onClick={() => onOpenChange(false)}>
              {labels.close}
            </Button>
            <Button variant="danger" disabled={isSaving} onClick={handleSubmit}>
              {isSaving ? "..." : labels.reverse.submit}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
