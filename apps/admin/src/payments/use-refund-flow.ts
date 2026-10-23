"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { APPROVAL_ACTION, type ApproverSummary } from "@banijjik/contracts/iam";
import { PAYMENT_RULE_KEYS, type PaymentResponse } from "@banijjik/contracts/payment";
import { useState } from "react";
import { ApiError } from "../lib/api/api-error";
import {
  grantApproval,
  listApprovers,
  refundPayment,
  type RefundPaymentInput,
} from "./payment-api";
import { useApprovalDialogState } from "./use-approval-dialog-state";

export interface RefundFlowState {
  readonly isSubmitting: boolean;
  readonly isApproving: boolean;
  readonly showApprovalDialog: boolean;
  readonly approvers: readonly ApproverSummary[];
  readonly isPinLocked: boolean;
  readonly errorMessage: string | undefined;
  readonly approvalError: string | undefined;
  readonly executeRefund: (input: RefundPaymentInput) => Promise<PaymentResponse | undefined>;
  readonly handleApprovalSubmit: (pinInput: {
    approverMemberId: string;
    pin: string;
  }) => Promise<PaymentResponse | undefined>;
  readonly closeApprovalDialog: () => void;
  readonly resetError: () => void;
}

function isApprovalError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return (
    error.messageKey === PAYMENT_RULE_KEYS.PAYMENT_APPROVAL_REQUIRED ||
    error.code === ERROR_CODE.APPROVAL_REQUIRED ||
    error.code === ERROR_CODE.VALIDATION_ERROR ||
    error.status === 422 ||
    error.status === 403
  );
}

async function loadApproversList(
  organizationId: string,
  locationId: string,
  noApproversMsg: string,
): Promise<{ approvers: readonly ApproverSummary[]; error?: string }> {
  try {
    const list = await listApprovers(organizationId, locationId);
    if (list.length === 0) return { approvers: [], error: noApproversMsg };
    return { approvers: list };
  } catch (err) {
    return {
      approvers: [],
      error: err instanceof Error ? err.message : "Failed to load approvers",
    };
  }
}

async function grantAndRefund(opts: {
  readonly organizationId: string;
  readonly pendingInput: RefundPaymentInput;
  readonly pinInput: { approverMemberId: string; pin: string };
}): Promise<PaymentResponse> {
  const grant = await grantApproval(opts.organizationId, {
    action: APPROVAL_ACTION.REFUND,
    subjectKey: opts.pendingInput.locationId,
    amount: opts.pendingInput.amount,
    locationId: opts.pendingInput.locationId,
    approverMemberId: opts.pinInput.approverMemberId,
    pin: opts.pinInput.pin,
  });
  return refundPayment(opts.organizationId, {
    ...opts.pendingInput,
    approvalToken: grant.approvalToken,
  });
}

async function submitApprovalPin(opts: {
  readonly organizationId: string;
  readonly pendingInput: RefundPaymentInput;
  readonly pinInput: { approverMemberId: string; pin: string };
  readonly setIsApproving: (v: boolean) => void;
  readonly setApprovalError: (v: string | undefined) => void;
  readonly closeApproval: () => void;
  readonly handlePinError: (err: unknown, fallback: string) => void;
  readonly onSuccess?: ((payment: PaymentResponse) => void) | undefined;
}): Promise<PaymentResponse | undefined> {
  opts.setIsApproving(true);
  opts.setApprovalError(undefined);
  try {
    const response = await grantAndRefund(opts);
    opts.closeApproval();
    opts.onSuccess?.(response);
    return response;
  } catch (error) {
    opts.handlePinError(error, "Approval failed");
    return undefined;
  } finally {
    opts.setIsApproving(false);
  }
}

async function performRefund(
  organizationId: string,
  input: RefundPaymentInput,
  onSuccess?: (payment: PaymentResponse) => void,
): Promise<{ response?: PaymentResponse; needsApproval?: boolean; error?: string }> {
  try {
    const response = await refundPayment(organizationId, input);
    onSuccess?.(response);
    return { response };
  } catch (error) {
    if (isApprovalError(error)) return { needsApproval: true };
    return { error: error instanceof Error ? error.message : "Refund failed" };
  }
}

function submitPendingApproval(opts: {
  readonly organizationId: string;
  readonly pendingInput?: RefundPaymentInput | undefined;
  readonly pinInput: { approverMemberId: string; pin: string };
  readonly approval: ReturnType<typeof useApprovalDialogState>;
  readonly onSuccess?: ((payment: PaymentResponse) => void) | undefined;
}): Promise<PaymentResponse | undefined> {
  if (!opts.pendingInput) return Promise.resolve(undefined);
  return submitApprovalPin({
    organizationId: opts.organizationId,
    pendingInput: opts.pendingInput,
    pinInput: opts.pinInput,
    setIsApproving: opts.approval.setIsApproving,
    setApprovalError: opts.approval.setApprovalError,
    closeApproval: opts.approval.closeApproval,
    handlePinError: opts.approval.handlePinError,
    onSuccess: opts.onSuccess,
  });
}

export function useRefundFlow(props: {
  readonly organizationId: string;
  readonly noApproversMessage: string;
  readonly onSuccess?: (payment: PaymentResponse) => void;
}): RefundFlowState {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [pendingInput, setPendingInput] = useState<RefundPaymentInput | undefined>();
  const approval = useApprovalDialogState();

  async function openApprovalFor(input: RefundPaymentInput): Promise<void> {
    setPendingInput(input);
    const result = await loadApproversList(
      props.organizationId,
      input.locationId,
      props.noApproversMessage,
    );
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    approval.openApproval(result.approvers);
  }

  async function executeRefund(input: RefundPaymentInput): Promise<PaymentResponse | undefined> {
    setIsSubmitting(true);
    setErrorMessage(undefined);
    try {
      const res = await performRefund(props.organizationId, input, props.onSuccess);
      if (res.needsApproval) await openApprovalFor(input);
      if (res.error) setErrorMessage(res.error);
      return res.response;
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleApprovalSubmit = (pinInput: { approverMemberId: string; pin: string }) =>
    submitPendingApproval({
      organizationId: props.organizationId,
      pendingInput,
      pinInput,
      approval,
      onSuccess: props.onSuccess,
    });

  return {
    isSubmitting,
    isApproving: approval.isApproving,
    showApprovalDialog: approval.dialogState.open,
    approvers: approval.dialogState.approvers,
    isPinLocked: approval.dialogState.isLocked,
    errorMessage,
    approvalError: approval.approvalError,
    executeRefund,
    handleApprovalSubmit,
    closeApprovalDialog: approval.closeApproval,
    resetError: () => setErrorMessage(undefined),
  };
}
