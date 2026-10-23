"use client";

import type { CreditPurchaseResponse } from "@banijjik/contracts/credit";
import { ApiError } from "../lib/api/api-error";
import { rejectCreditPurchase } from "./credit-purchase-api";
import type { CreditPurchaseLabels } from "./credit-purchase-labels";

export function usePurchaseReject(args: {
  purchase: CreditPurchaseResponse | undefined;
  organizationId: string;
  rejectReason: string;
  labels: CreditPurchaseLabels;
  onUpdated: () => void;
  setIsBusy: (busy: boolean) => void;
  setRejecting: (rejecting: boolean) => void;
  setErrorMessage: (msg: string | undefined) => void;
}): () => Promise<void> {
  const {
    purchase,
    organizationId,
    rejectReason,
    labels,
    onUpdated,
    setIsBusy,
    setRejecting,
    setErrorMessage,
  } = args;

  return async function handleReject(): Promise<void> {
    if (!purchase) return;
    const trimmed = rejectReason.trim();
    if (!trimmed || trimmed.length > 200) {
      setErrorMessage(labels.rejectReasonInvalid);
      return;
    }
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      await rejectCreditPurchase(organizationId, {
        creditPurchaseId: purchase.creditPurchaseId,
        version: purchase.version,
        reason: trimmed,
      });
      setRejecting(false);
      onUpdated();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError && error.status === 409
          ? labels.conflict
          : labels.rejectReasonInvalid,
      );
    } finally {
      setIsBusy(false);
    }
  };
}
