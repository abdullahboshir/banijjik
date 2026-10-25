"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import type { ApproverSummary } from "@banijjik/contracts/iam";
import { useRef } from "react";
import { ApiError } from "../lib/api/api-error";
import { grantApproval, listApprovers } from "../payments/payment-api";
import {
  useApprovalDialogState,
  type UseApprovalDialogStateResult,
} from "../payments/use-approval-dialog-state";
import type { ApprovalDialogView } from "./order-approval";
import type { OrderApprovalLabels } from "./order-labels";
import type { ApprovalStep } from "./return-model";

/** The tokens granted so far, keyed like the steps (`refund`, `returnNotReceived`, `approvalToken`). */
export type GrantedApprovals = Readonly<Record<string, string>>;

/** The staff member closed the PIN sheet; the caller stops quietly. */
export class ApprovalCancelledError extends Error {
  constructor() {
    super("approval cancelled");
    this.name = "ApprovalCancelledError";
  }
}

export interface ReturnApprovalFlow {
  /** The PIN sheet's state and handlers, for `OrderApprovalDialog`. */
  readonly dialog: ApprovalDialogView;
  /**
   * Asks for one PIN per step, in order, and resolves with every token once all are granted.
   * Rejects with `ApprovalCancelledError` when the sheet is closed.
   */
  readonly collect: (steps: readonly ApprovalStep[]) => Promise<GrantedApprovals>;
}

interface PendingCollection {
  readonly steps: readonly ApprovalStep[];
  readonly granted: GrantedApprovals;
  readonly resolve: (granted: GrantedApprovals) => void;
  readonly reject: (error: unknown) => void;
}

interface GrantProgress {
  readonly remaining: readonly ApprovalStep[];
  readonly granted: GrantedApprovals;
}

function isApprovalRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === ERROR_CODE.APPROVAL_REQUIRED;
}

function isPinError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === ERROR_CODE.APPROVAL_PIN_LOCKED || error.code === ERROR_CODE.APPROVAL_INVALID)
  );
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

/** Grants the first pending step with the PIN given, and reports what is still pending. */
async function grantFirstStep(
  organizationId: string,
  pending: PendingCollection,
  input: { readonly approverMemberId: string; readonly pin: string },
): Promise<GrantProgress> {
  const [step, ...remaining] = pending.steps;
  if (step === undefined) return { remaining: [], granted: pending.granted };
  const grant = await grantApproval(organizationId, {
    action: step.action,
    subjectKey: step.subjectKey,
    amount: step.amount,
    locationId: step.locationId,
    approverMemberId: input.approverMemberId,
    pin: input.pin,
  });
  return { remaining, granted: { ...pending.granted, [step.key]: grant.approvalToken } };
}

/** The PIN sheet's view for the caller: the state and the two handlers, without the retry. */
function dialogViewOf(
  dialogState: UseApprovalDialogStateResult,
  handlers: Pick<ApprovalDialogView, "submitPin" | "close">,
): ApprovalDialogView {
  return {
    isOpen: dialogState.dialogState.open,
    approvers: dialogState.dialogState.approvers,
    isLocked: dialogState.dialogState.isLocked,
    isApproving: dialogState.isApproving,
    errorMessage: dialogState.approvalError,
    submitPin: handlers.submitPin,
    close: handlers.close,
  };
}

/**
 * The manager PIN sheet for a return or a reversal. A return can need two PINs (a refund and a
 * not-received line), so the steps are asked one after the other with the same approver list.
 */
export function useReturnApprovalFlow(
  organizationId: string,
  labels: OrderApprovalLabels,
): ReturnApprovalFlow {
  const dialogState = useApprovalDialogState();
  const pendingRef = useRef<PendingCollection | undefined>(undefined);

  function finish(): void {
    pendingRef.current = undefined;
    dialogState.closeApproval();
  }

  async function collect(steps: readonly ApprovalStep[]): Promise<GrantedApprovals> {
    const [firstStep] = steps;
    if (firstStep === undefined) return {};
    const approvers = await loadApprovers(organizationId, firstStep.locationId, labels);
    return new Promise<GrantedApprovals>((resolve, reject) => {
      pendingRef.current = { steps, granted: {}, resolve, reject };
      dialogState.openApproval(approvers);
    });
  }

  async function submitPin(input: { approverMemberId: string; pin: string }): Promise<void> {
    const pending = pendingRef.current;
    if (pending === undefined) return;
    dialogState.setIsApproving(true);
    dialogState.setApprovalError(undefined);
    try {
      const progress = await grantFirstStep(organizationId, pending, input);
      if (progress.remaining.length > 0) {
        pendingRef.current = { ...pending, steps: progress.remaining, granted: progress.granted };
        return;
      }
      finish();
      pending.resolve(progress.granted);
    } catch (error) {
      if (isApprovalRequired(error) || isPinError(error)) {
        dialogState.handlePinError(error, labels.failed);
        return;
      }
      finish();
      pending.reject(error);
    } finally {
      dialogState.setIsApproving(false);
    }
  }

  function close(): void {
    const pending = pendingRef.current;
    finish();
    pending?.reject(new ApprovalCancelledError());
  }

  return { dialog: dialogViewOf(dialogState, { submitPin, close }), collect };
}
