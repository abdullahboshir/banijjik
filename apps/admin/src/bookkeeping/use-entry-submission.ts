"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { newId } from "@banijjik/ids";
import {
  manualJournalContent,
  type ManualJournalEntryRequest,
  type JournalEntryResponse,
} from "@banijjik/contracts/accounting";
import { apiFetch } from "../lib/api/api-client";
import { ApiError } from "../lib/api/api-error";
import type { BookkeepingLabels } from "./labels";
interface SubmissionProps {
  organizationId: string;
  orgSlug: string;
  labels: BookkeepingLabels;
}
interface EntrySubmission {
  pending: boolean;
  error: string;
  approvalBody: ManualJournalEntryRequest | undefined;
  setApprovalBody: (body: ManualJournalEntryRequest | undefined) => void;
  submit: (body: ManualJournalEntryRequest, token?: string) => Promise<void>;
}
export function useEntrySubmission(props: SubmissionProps): EntrySubmission {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [approvalBody, setApprovalBody] = useState<ManualJournalEntryRequest>();
  const operation = useRef({
    fingerprint: "",
    key: newId(),
    token: undefined as string | undefined,
  });
  const router = useRouter();
  async function submit(request: ManualJournalEntryRequest, token?: string): Promise<void> {
    const fingerprint = manualJournalContent(request);
    if (operation.current.fingerprint !== fingerprint)
      operation.current = { fingerprint, key: newId(), token: undefined };
    if (token !== undefined) operation.current.token = token;
    setPending(true);
    setError("");
    try {
      await apiFetch<JournalEntryResponse>(
        `/orgs/${props.organizationId}/bookkeeping/journal/manual`,
        {
          method: "POST",
          body: {
            ...request,
            ...(operation.current.token === undefined
              ? {}
              : { approvalToken: operation.current.token }),
          },
          idempotencyKey: operation.current.key,
        },
      );
      router.push(`/${props.orgSlug}/money/journal`);
      router.refresh();
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "APPROVAL_REQUIRED")
        setApprovalBody(request);
      else setError(props.labels.failure);
    } finally {
      setPending(false);
    }
  }
  return { pending, error, approvalBody, setApprovalBody, submit };
}
