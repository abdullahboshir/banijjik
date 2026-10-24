"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { APPROVAL_ACTION, type ApproverSummary } from "@banijjik/contracts/iam";
import type { Money } from "@banijjik/contracts/pricing";
import { useState } from "react";
import { ApiError } from "../lib/api/api-error";
import { grantApproval, listApprovers } from "../payments/payment-api";
import { useApprovalDialogState } from "../payments/use-approval-dialog-state";
import type { OrderApprovalLabels } from "./order-labels";

/** What the approver signs off: one order (or the next instant sale) and the manual discount amount. */
export interface OrderApprovalRequest {
  readonly subjectKey: string;
  readonly locationId: string;
  readonly amount: Money;
}

export type OrderApprovalAction = (approvalToken?: string) => Promise<void>;

interface PendingApproval {
  readonly request: OrderApprovalRequest;
  readonly action: OrderApprovalAction;
  readonly onApproved: () => void;
}

export interface OrderApprovalFlow {
  readonly isOpen: boolean;
  readonly approvers: readonly ApproverSummary[];
  readonly isLocked: boolean;
  readonly isApproving: boolean;
  readonly errorMessage: string | undefined;
  /**
   * Runs the action without a token. On `403 APPROVAL_REQUIRED` it loads the approvers and opens the
   * dialog; the dialog retries the very same action with the granted token.
   */
  readonly attempt: (
    request: OrderApprovalRequest,
    action: OrderApprovalAction,
    onApproved: () => void,
  ) => Promise<void>;
  readonly submitPin: (input: { approverMemberId: string; pin: string }) => Promise<void>;
  readonly close: () => void;
}

function isApprovalRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === ERROR_CODE.APPROVAL_REQUIRED;
}

async function loadApprovers(
  organizationId: string,
  locationId: string,
  labels: OrderApprovalLabels,
): Promise<readonly ApproverSummary[]> {
  let approvers: readonly ApproverSummary[];
  try {
    approvers = await listApprovers(organizationId, locationId);
  } catch (error) {
    throw error instanceof Error ? error : new Error(labels.loadFailed);
  }
  if (approvers.length === 0) throw new Error(labels.noApprovers);
  return approvers;
}

async function grantTokenFor(
  organizationId: string,
  request: OrderApprovalRequest,
  input: { approverMemberId: string; pin: string },
): Promise<string> {
  const grant = await grantApproval(organizationId, {
    action: APPROVAL_ACTION.DISCOUNT,
    subjectKey: request.subjectKey,
    amount: request.amount,
    locationId: request.locationId,
    approverMemberId: input.approverMemberId,
    pin: input.pin,
  });
  return grant.approvalToken;
}

export interface UseOrderApprovalFlowProps {
  readonly organizationId: string;
  readonly labels: OrderApprovalLabels;
  /** A failure that is not about the PIN (a stock refusal, a conflict) reaches the caller's screen. */
  readonly onFailure: (error: unknown) => void;
}

export function useOrderApprovalFlow(props: UseOrderApprovalFlowProps): OrderApprovalFlow {
  const approval = useApprovalDialogState();
  const [pending, setPending] = useState<PendingApproval | undefined>();

  async function attempt(
    request: OrderApprovalRequest,
    action: OrderApprovalAction,
    onApproved: () => void,
  ): Promise<void> {
    try {
      await action(undefined);
      onApproved();
    } catch (error) {
      if (!isApprovalRequired(error)) throw error;
      const approvers = await loadApprovers(props.organizationId, request.locationId, props.labels);
      setPending({ request, action, onApproved });
      approval.openApproval(approvers);
    }
  }

  async function submitPin(input: { approverMemberId: string; pin: string }): Promise<void> {
    if (pending === undefined) return;
    approval.setIsApproving(true);
    approval.setApprovalError(undefined);
    try {
      await pending.action(await grantTokenFor(props.organizationId, pending.request, input));
      setPending(undefined);
      approval.closeApproval();
      pending.onApproved();
    } catch (error) {
      if (isApprovalRequired(error) || isPinError(error)) {
        approval.handlePinError(error, props.labels.failed);
        return;
      }
      setPending(undefined);
      approval.closeApproval();
      props.onFailure(error);
    } finally {
      approval.setIsApproving(false);
    }
  }

  function close(): void {
    setPending(undefined);
    approval.closeApproval();
  }

  return {
    isOpen: approval.dialogState.open,
    approvers: approval.dialogState.approvers,
    isLocked: approval.dialogState.isLocked,
    isApproving: approval.isApproving,
    errorMessage: approval.approvalError,
    attempt,
    submitPin,
    close,
  };
}

function isPinError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === ERROR_CODE.APPROVAL_PIN_LOCKED || error.code === ERROR_CODE.APPROVAL_INVALID)
  );
}
