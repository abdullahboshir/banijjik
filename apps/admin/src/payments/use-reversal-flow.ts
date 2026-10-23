"use client";

import type { ApproverSummary } from "@banijjik/contracts/iam";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { type PaymentResponse } from "@banijjik/contracts/payment";
import { useState } from "react";
import { ApiError } from "../lib/api/api-error";
import { grantApproval, listApprovers, reversePayment } from "./payment-api";
import { useApprovalDialogState } from "./use-approval-dialog-state";

export interface ReversalFlowState {
  readonly isSubmitting: boolean;
  readonly isApproving: boolean;
  readonly showPinDialog: boolean;
  readonly approvers: readonly ApproverSummary[];
  readonly isPinLocked: boolean;
  readonly isConflict: boolean;
  readonly errorMessage: string | undefined;
  readonly approvalError: string | undefined;
  readonly initiateReversal: (note?: string | null) => Promise<void>;
  readonly submitPin: (pinInput: {
    approverMemberId: string;
    pin: string;
  }) => Promise<PaymentResponse | undefined>;
  readonly closePinDialog: () => void;
  readonly reset: () => void;
}

async function grantAndReverse(opts: {
  readonly organizationId: string;
  readonly payment: PaymentResponse;
  readonly reversalNote: string | null;
  readonly pinInput: { approverMemberId: string; pin: string };
}): Promise<PaymentResponse> {
  const grant = await grantApproval(opts.organizationId, {
    action: APPROVAL_ACTION.PAYMENT_REVERSAL,
    subjectKey: opts.payment.paymentId,
    amount: opts.payment.amount,
    locationId: opts.payment.locationId,
    approverMemberId: opts.pinInput.approverMemberId,
    pin: opts.pinInput.pin,
  });
  return reversePayment(opts.organizationId, opts.payment.paymentId, {
    approvalToken: grant.approvalToken,
    note: opts.reversalNote,
  });
}

async function executePinReversal(opts: {
  readonly organizationId: string;
  readonly payment: PaymentResponse;
  readonly reversalNote: string | null;
  readonly pinInput: { approverMemberId: string; pin: string };
  readonly fallbackError: string;
  readonly setIsApproving: (v: boolean) => void;
  readonly setApprovalError: (v: string | undefined) => void;
  readonly setIsConflict: (v: boolean) => void;
  readonly closeApproval: () => void;
  readonly handlePinError: (err: unknown, fallback: string) => void;
  readonly onSuccess?: ((payment: PaymentResponse) => void) | undefined;
}): Promise<PaymentResponse | undefined> {
  opts.setIsApproving(true);
  opts.setApprovalError(undefined);
  try {
    const response = await grantAndReverse(opts);
    opts.closeApproval();
    opts.onSuccess?.(response);
    return response;
  } catch (error) {
    const isConflict = error instanceof ApiError && error.status === 409;
    opts.setIsConflict(isConflict);
    if (isConflict) {
      opts.closeApproval();
    } else {
      opts.handlePinError(error, opts.fallbackError);
    }
    return undefined;
  } finally {
    opts.setIsApproving(false);
  }
}

async function loadAndOpenApprovers(opts: {
  readonly organizationId: string;
  readonly locationId: string;
  readonly noApproversMsg: string;
  readonly fallbackError: string;
  readonly openApproval: (list: readonly ApproverSummary[]) => void;
}): Promise<string | undefined> {
  try {
    const list = await listApprovers(opts.organizationId, opts.locationId);
    if (list.length === 0) return opts.noApproversMsg;
    opts.openApproval(list);
    return undefined;
  } catch (err) {
    return err instanceof Error ? err.message : opts.fallbackError;
  }
}

function resetReversalState(
  setErrorMessage: (v: string | undefined) => void,
  setApprovalError: (v: string | undefined) => void,
  setIsConflict: (v: boolean) => void,
): void {
  setErrorMessage(undefined);
  setApprovalError(undefined);
  setIsConflict(false);
}

export interface UseReversalFlowProps {
  readonly organizationId: string;
  readonly payment: PaymentResponse;
  readonly noApproversMessage: string;
  readonly failedMessage?: string | undefined;
  readonly loadApproversFailedMessage?: string | undefined;
  readonly onSuccess?: ((payment: PaymentResponse) => void) | undefined;
}

export function useReversalFlow(props: UseReversalFlowProps): ReversalFlowState {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConflict, setIsConflict] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [reversalNote, setReversalNote] = useState<string | null>(null);
  const approval = useApprovalDialogState();

  const failedMsg = props.failedMessage ?? "Reversal failed";
  const loadApproversMsg = props.loadApproversFailedMessage ?? "Failed to load approvers";

  async function initiateReversal(note?: string | null): Promise<void> {
    setReversalNote(note ?? null);
    setIsConflict(false);
    setErrorMessage(undefined);
    setIsSubmitting(true);
    try {
      const err = await loadAndOpenApprovers({
        organizationId: props.organizationId,
        locationId: props.payment.locationId,
        noApproversMsg: props.noApproversMessage,
        fallbackError: loadApproversMsg,
        openApproval: approval.openApproval,
      });
      if (err) setErrorMessage(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitPin = (pinInput: { approverMemberId: string; pin: string }) =>
    executePinReversal({
      organizationId: props.organizationId,
      payment: props.payment,
      reversalNote,
      pinInput,
      fallbackError: failedMsg,
      setIsApproving: approval.setIsApproving,
      setApprovalError: approval.setApprovalError,
      setIsConflict,
      closeApproval: approval.closeApproval,
      handlePinError: approval.handlePinError,
      onSuccess: props.onSuccess,
    });

  return {
    isSubmitting,
    isApproving: approval.isApproving,
    showPinDialog: approval.dialogState.open,
    approvers: approval.dialogState.approvers,
    isPinLocked: approval.dialogState.isLocked,
    isConflict,
    errorMessage,
    approvalError: approval.approvalError,
    initiateReversal,
    submitPin,
    closePinDialog: approval.closeApproval,
    reset: () => resetReversalState(setErrorMessage, approval.setApprovalError, setIsConflict),
  };
}
