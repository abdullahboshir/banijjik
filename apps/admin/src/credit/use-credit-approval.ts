"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { APPROVAL_ACTION, type ApproverSummary } from "@banijjik/contracts/iam";
import { useTranslator } from "@banijjik/web-client/client";
import { useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { adjustCredits, grantApproval, listApprovers } from "./credit-api";

export interface PendingAdjustment {
  credits: number;
  reason: string;
  locationId: string;
}

export interface CreditApproval {
  pending: PendingAdjustment | undefined;
  approvers: ApproverSummary[];
  errorMessage: string | undefined;
  isLocked: boolean;
  isGranting: boolean;
  /** Lists the approvers of the location and opens the PIN dialog; a refusal comes back as text. */
  open: (
    body: { credits: number; reason: string },
    locationId: string,
  ) => Promise<string | undefined>;
  approve: (input: { approverMemberId: string; pin: string }) => Promise<void>;
  close: () => void;
}

async function postWithApproval(input: {
  organizationId: string;
  customerAccountId: string;
  pending: PendingAdjustment;
  pin: { approverMemberId: string; pin: string };
}): Promise<void> {
  const grant = await grantApproval(input.organizationId, {
    action: APPROVAL_ACTION.CREDIT_ADJUSTMENT,
    subjectKey: input.customerAccountId,
    locationId: input.pending.locationId,
    approverMemberId: input.pin.approverMemberId,
    pin: input.pin.pin,
  });
  await adjustCredits(input.organizationId, input.customerAccountId, {
    credits: input.pending.credits,
    reason: input.pending.reason,
    approvalToken: grant.approvalToken,
  });
}

/** The manager-PIN half of a credit adjustment: list the approvers, grant the token, then send the entry. */
export function useCreditApproval(props: {
  organizationId: string;
  customerAccountId: string;
  noApproversLabel: string;
  onAdjusted: () => void;
}): CreditApproval {
  const { t } = useTranslator();
  const [pending, setPending] = useState<PendingAdjustment | undefined>();
  const [approvers, setApprovers] = useState<ApproverSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isLocked, setIsLocked] = useState(false);
  const [isGranting, setIsGranting] = useState(false);

  function close(): void {
    setPending(undefined);
    setApprovers([]);
    setErrorMessage(undefined);
    setIsLocked(false);
  }

  async function open(
    body: { credits: number; reason: string },
    locationId: string,
  ): Promise<string | undefined> {
    try {
      const listed = await listApprovers(props.organizationId, locationId);
      if (listed.length === 0) return props.noApproversLabel;
      setApprovers(listed);
      setErrorMessage(undefined);
      setIsLocked(false);
      setPending({ ...body, locationId });
      return undefined;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return t(knownMessageKeyOrInternal(error.messageKey));
    }
  }

  async function approve(input: { approverMemberId: string; pin: string }): Promise<void> {
    if (pending === undefined) return;
    setIsGranting(true);
    setErrorMessage(undefined);
    setIsLocked(false);
    try {
      await postWithApproval({
        organizationId: props.organizationId,
        customerAccountId: props.customerAccountId,
        pending,
        pin: input,
      });
      close();
      props.onAdjusted();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      setIsLocked(error.code === ERROR_CODE.APPROVAL_PIN_LOCKED);
      setErrorMessage(t(knownMessageKeyOrInternal(error.messageKey)));
    } finally {
      setIsGranting(false);
    }
  }

  return { pending, approvers, errorMessage, isLocked, isGranting, open, approve, close };
}
