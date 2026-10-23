"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import type { CreditPurchaseResponse } from "@banijjik/contracts/credit";
import { APPROVAL_ACTION, type ApproverSummary } from "@banijjik/contracts/iam";
import { useTranslator } from "@banijjik/web-client/client";
import { useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { grantApproval, listApprovers } from "./credit-api";
import { verifyCreditPurchase } from "./credit-purchase-api";

export interface PurchaseApproval {
  pendingPurchase: CreditPurchaseResponse | undefined;
  approvers: ApproverSummary[];
  errorMessage: string | undefined;
  isLocked: boolean;
  isGranting: boolean;
  open: (purchase: CreditPurchaseResponse, locationId: string) => Promise<string | undefined>;
  approve: (input: { approverMemberId: string; pin: string }) => Promise<void>;
  close: () => void;
}

interface ApprovalState {
  pendingPurchase?: CreditPurchaseResponse | undefined;
  locationId: string;
  approvers: ApproverSummary[];
  errorMessage?: string | undefined;
  isLocked: boolean;
  isGranting: boolean;
}

const initialApprovalState: ApprovalState = {
  locationId: "",
  approvers: [],
  isLocked: false,
  isGranting: false,
};

async function executeApprovalAndVerify(args: {
  organizationId: string;
  pendingPurchase: CreditPurchaseResponse;
  locationId: string;
  input: { approverMemberId: string; pin: string };
}): Promise<void> {
  const grant = await grantApproval(args.organizationId, {
    action: APPROVAL_ACTION.CREDIT_PURCHASE_VERIFY,
    subjectKey: args.pendingPurchase.creditPurchaseId,
    amount: args.pendingPurchase.snapshot.price,
    locationId: args.locationId,
    approverMemberId: args.input.approverMemberId,
    pin: args.input.pin,
  });
  await verifyCreditPurchase(args.organizationId, {
    creditPurchaseId: args.pendingPurchase.creditPurchaseId,
    version: args.pendingPurchase.version,
    approvalToken: grant.approvalToken,
  });
}

async function fetchApprovers(args: {
  organizationId: string;
  targetLocationId: string;
  noApproversLabel: string;
}): Promise<{ approvers: ApproverSummary[] } | { error: string }> {
  try {
    const listed = await listApprovers(args.organizationId, args.targetLocationId);
    if (listed.length === 0) return { error: args.noApproversLabel };
    return { approvers: listed };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: error.messageKey };
  }
}

function parseApprovalError(error: unknown): { isLocked: boolean; messageKey: string } {
  if (error instanceof ApiError) {
    return {
      isLocked: error.code === ERROR_CODE.APPROVAL_PIN_LOCKED,
      messageKey: error.messageKey,
    };
  }
  throw error;
}

export function usePurchaseApproval(props: {
  organizationId: string;
  noApproversLabel: string;
  onVerified: () => void;
}): PurchaseApproval {
  const { t } = useTranslator();
  const [state, setState] = useState<ApprovalState>(initialApprovalState);

  async function open(
    purchase: CreditPurchaseResponse,
    targetLocationId: string,
  ): Promise<string | undefined> {
    const result = await fetchApprovers({
      organizationId: props.organizationId,
      targetLocationId,
      noApproversLabel: props.noApproversLabel,
    });
    if ("error" in result) return t(knownMessageKeyOrInternal(result.error));
    setState({
      pendingPurchase: purchase,
      locationId: targetLocationId,
      approvers: result.approvers,
      isLocked: false,
      isGranting: false,
    });
    return undefined;
  }

  async function approve(input: { approverMemberId: string; pin: string }): Promise<void> {
    if (!state.pendingPurchase) return;
    setState((prev) => ({ ...prev, isGranting: true, errorMessage: undefined, isLocked: false }));
    try {
      await executeApprovalAndVerify({
        organizationId: props.organizationId,
        pendingPurchase: state.pendingPurchase,
        locationId: state.locationId,
        input,
      });
      setState(initialApprovalState);
      props.onVerified();
    } catch (error) {
      const parsed = parseApprovalError(error);
      setState((prev) => ({
        ...prev,
        isLocked: parsed.isLocked,
        errorMessage: t(knownMessageKeyOrInternal(parsed.messageKey)),
      }));
    } finally {
      setState((prev) => ({ ...prev, isGranting: false }));
    }
  }

  return {
    pendingPurchase: state.pendingPurchase,
    approvers: state.approvers,
    errorMessage: state.errorMessage,
    isLocked: state.isLocked,
    isGranting: state.isGranting,
    open,
    approve,
    close: () => setState(initialApprovalState),
  };
}
