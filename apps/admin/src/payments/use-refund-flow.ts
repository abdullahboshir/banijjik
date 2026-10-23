"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { APPROVAL_ACTION, type ApproverSummary } from "@banijjik/contracts/iam";
import { type PaymentResponse } from "@banijjik/contracts/payment";
import type { Translator } from "@banijjik/i18n";
import { useTranslator } from "@banijjik/web-client/client";
import { useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
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
  return error.code === ERROR_CODE.APPROVAL_REQUIRED;
}

function formatRefundError(error: unknown, fallback: string, t: Translator["t"]): string {
  if (error instanceof ApiError) return t(knownMessageKeyOrInternal(error.messageKey));
  if (error instanceof Error) return error.message;
  return fallback;
}

async function loadApproversList(opts: {
  readonly organizationId: string;
  readonly locationId: string;
  readonly noApproversMsg: string;
  readonly fallbackError: string;
}): Promise<{ approvers: readonly ApproverSummary[]; error?: string }> {
  try {
    const list = await listApprovers(opts.organizationId, opts.locationId);
    if (list.length === 0) return { approvers: [], error: opts.noApproversMsg };
    return { approvers: list };
  } catch (err) {
    return {
      approvers: [],
      error: err instanceof Error ? err.message : opts.fallbackError,
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
  readonly approvalFailedMsg: string;
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
    opts.handlePinError(error, opts.approvalFailedMsg);
    return undefined;
  } finally {
    opts.setIsApproving(false);
  }
}

async function performRefund(opts: {
  readonly organizationId: string;
  readonly input: RefundPaymentInput;
  readonly fallbackError: string;
  readonly t: Translator["t"];
  readonly onSuccess?: ((payment: PaymentResponse) => void) | undefined;
}): Promise<{ response?: PaymentResponse; needsApproval?: boolean; error?: string }> {
  try {
    const response = await refundPayment(opts.organizationId, opts.input);
    opts.onSuccess?.(response);
    return { response };
  } catch (error) {
    if (isApprovalError(error)) return { needsApproval: true };
    return { error: formatRefundError(error, opts.fallbackError, opts.t) };
  }
}

function submitPendingApproval(opts: {
  readonly organizationId: string;
  readonly pendingInput?: RefundPaymentInput | undefined;
  readonly pinInput: { approverMemberId: string; pin: string };
  readonly approval: ReturnType<typeof useApprovalDialogState>;
  readonly approvalFailedMsg: string;
  readonly onSuccess?: ((payment: PaymentResponse) => void) | undefined;
}): Promise<PaymentResponse | undefined> {
  if (!opts.pendingInput) return Promise.resolve(undefined);
  return submitApprovalPin({
    organizationId: opts.organizationId,
    pendingInput: opts.pendingInput,
    pinInput: opts.pinInput,
    approvalFailedMsg: opts.approvalFailedMsg,
    setIsApproving: opts.approval.setIsApproving,
    setApprovalError: opts.approval.setApprovalError,
    closeApproval: opts.approval.closeApproval,
    handlePinError: opts.approval.handlePinError,
    onSuccess: opts.onSuccess,
  });
}

export interface UseRefundFlowProps {
  readonly organizationId: string;
  readonly noApproversMessage: string;
  readonly failedMessage?: string | undefined;
  readonly approvalFailedMessage?: string | undefined;
  readonly loadApproversFailedMessage?: string | undefined;
  readonly onSuccess?: ((payment: PaymentResponse) => void) | undefined;
}

async function executeRefundCall(opts: {
  readonly organizationId: string;
  readonly input: RefundPaymentInput;
  readonly failedMsg: string;
  readonly t: Translator["t"];
  readonly onSuccess?: ((payment: PaymentResponse) => void) | undefined;
  readonly setIsSubmitting: (v: boolean) => void;
  readonly setErrorMessage: (v: string | undefined) => void;
  readonly openApprovalFor: (input: RefundPaymentInput) => Promise<void>;
}): Promise<PaymentResponse | undefined> {
  opts.setIsSubmitting(true);
  opts.setErrorMessage(undefined);
  try {
    const res = await performRefund({
      organizationId: opts.organizationId,
      input: opts.input,
      fallbackError: opts.failedMsg,
      t: opts.t,
      onSuccess: opts.onSuccess,
    });
    if (res.needsApproval) await opts.openApprovalFor(opts.input);
    if (res.error) opts.setErrorMessage(res.error);
    return res.response;
  } finally {
    opts.setIsSubmitting(false);
  }
}

export function useRefundFlow(props: UseRefundFlowProps): RefundFlowState {
  const { t } = useTranslator();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [pendingInput, setPendingInput] = useState<RefundPaymentInput | undefined>();
  const approval = useApprovalDialogState();

  const failedMsg = props.failedMessage ?? "Refund failed";
  const approvalFailedMsg = props.approvalFailedMessage ?? "Approval failed";
  const loadApproversMsg = props.loadApproversFailedMessage ?? "Failed to load approvers";

  async function openApprovalFor(input: RefundPaymentInput): Promise<void> {
    setPendingInput(input);
    const result = await loadApproversList({
      organizationId: props.organizationId,
      locationId: input.locationId,
      noApproversMsg: props.noApproversMessage,
      fallbackError: loadApproversMsg,
    });
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    approval.openApproval(result.approvers);
  }

  const executeRefund = (input: RefundPaymentInput) =>
    executeRefundCall({
      organizationId: props.organizationId,
      input,
      failedMsg,
      t,
      onSuccess: props.onSuccess,
      setIsSubmitting,
      setErrorMessage,
      openApprovalFor,
    });

  const handleApprovalSubmit = (pinInput: { approverMemberId: string; pin: string }) =>
    submitPendingApproval({
      organizationId: props.organizationId,
      pendingInput,
      pinInput,
      approval,
      approvalFailedMsg,
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
