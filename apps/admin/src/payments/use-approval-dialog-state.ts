"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import type { ApproverSummary } from "@banijjik/contracts/iam";
import { type Dispatch, type SetStateAction, useState } from "react";
import { ApiError } from "../lib/api/api-error";

export interface ApprovalDialogState {
  readonly open: boolean;
  readonly approvers: readonly ApproverSummary[];
  readonly isLocked: boolean;
}

export interface UseApprovalDialogStateResult {
  readonly dialogState: ApprovalDialogState;
  readonly approvalError: string | undefined;
  readonly setApprovalError: Dispatch<SetStateAction<string | undefined>>;
  readonly isApproving: boolean;
  readonly setIsApproving: Dispatch<SetStateAction<boolean>>;
  readonly openApproval: (approvers: readonly ApproverSummary[]) => void;
  readonly closeApproval: () => void;
  readonly handlePinError: (error: unknown, fallback: string) => void;
}

function formatPinError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.messageKey;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function useApprovalDialogState(): UseApprovalDialogStateResult {
  const [dialogState, setDialogState] = useState<ApprovalDialogState>({
    open: false,
    approvers: [],
    isLocked: false,
  });
  const [approvalError, setApprovalError] = useState<string | undefined>();
  const [isApproving, setIsApproving] = useState(false);

  function openApproval(approvers: readonly ApproverSummary[]): void {
    setApprovalError(undefined);
    setDialogState({ open: true, approvers, isLocked: false });
  }

  function closeApproval(): void {
    setDialogState((prev) => ({ ...prev, open: false }));
  }

  function handlePinError(error: unknown, fallback: string): void {
    const isLocked = error instanceof ApiError && error.code === ERROR_CODE.APPROVAL_PIN_LOCKED;
    setDialogState((prev) => ({ ...prev, isLocked }));
    setApprovalError(formatPinError(error, fallback));
  }

  return {
    dialogState,
    approvalError,
    setApprovalError,
    isApproving,
    setIsApproving,
    openApproval,
    closeApproval,
    handlePinError,
  };
}
