"use client";
import { useEffect, useState, type ReactElement } from "react";
import { ApprovalPinDialog } from "@banijjik/ui";
import type { ApproverSummary, ApprovalGrantResponse } from "@banijjik/contracts/iam";
import { apiFetch } from "../lib/api/api-client";
import type { BookkeepingLabels } from "./labels";
import type { LocationOption } from "./entry-form-view";
export interface JournalApprovalProps {
  organizationId: string;
  userId: string;
  locationId: string;
  locations?: readonly LocationOption[];
  subjectContent: string;
  amount: number;
  labels: BookkeepingLabels;
  onCancel: () => void;
  onApproved: (token: string) => void;
  reverseSubject?: string;
}
export function JournalApproval(props: JournalApprovalProps): ReactElement {
  const [approvers, setApprovers] = useState<ApproverSummary[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const labels = props.labels;
  const locationId = props.locationId === "" ? "ALL" : props.locationId;
  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const result = await apiFetch<ApproverSummary[]>(
          `/orgs/${props.organizationId}/approvers?locationId=${encodeURIComponent(locationId)}`,
        );
        if (active) setApprovers(result.data);
      } catch {
        if (active) setError(labels.failure);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [props.organizationId, locationId, labels]);
  async function approve(input: { approverMemberId: string; pin: string }): Promise<void> {
    setPending(true);
    setError("");
    try {
      const result = await grantJournalApproval(props, input, locationId);
      props.onApproved(result.data.approvalToken);
    } catch {
      setError(labels.failure);
    } finally {
      setPending(false);
    }
  }
  return (
    <ApprovalPinDialog
      open
      onOpenChange={(open) => {
        if (!open) props.onCancel();
      }}
      title={labels.approval}
      approverLabel={labels.approver}
      pinLabel={labels.pin}
      submitLabel={labels.approve}
      cancelLabel={labels.cancel}
      closeLabel={labels.close}
      lockedMessage={labels.locked}
      approvers={approvers}
      errorMessage={error}
      isSubmitting={pending}
      onSubmit={(input) => {
        void approve(input);
      }}
    />
  );
}

async function grantJournalApproval(
  props: JournalApprovalProps,
  input: { approverMemberId: string; pin: string },
  locationId: string,
): Promise<{ data: ApprovalGrantResponse }> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(props.subjectContent),
  );
  const hash = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  const result = await apiFetch<ApprovalGrantResponse>(`/orgs/${props.organizationId}/approvals`, {
    method: "POST",
    body: {
      ...input,
      action: "MANUAL_JOURNAL",
      subjectKey: props.reverseSubject ?? `manual:${hash}`,
      amount: { amount: props.amount, currency: "BDT" },
      locationId,
    },
  });
  return result;
}

export default JournalApproval;
