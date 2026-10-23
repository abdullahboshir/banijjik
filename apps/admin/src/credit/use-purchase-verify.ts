"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import type { CreditPurchaseResponse } from "@banijjik/contracts/credit";
import { useTranslator } from "@banijjik/web-client/client";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { verifyCreditPurchase } from "./credit-purchase-api";
import type { CreditPurchaseLabels } from "./credit-purchase-labels";
import type { PurchaseApproval } from "./use-purchase-approval";

function parseVerifyError(
  error: unknown,
  labels: CreditPurchaseLabels,
  translate: (k: string) => string,
): { isApprovalRequired: boolean; message: string } {
  if (error instanceof ApiError) {
    if (error.code === ERROR_CODE.APPROVAL_REQUIRED)
      return { isApprovalRequired: true, message: "" };
    const msg =
      error.status === 409
        ? labels.conflict
        : translate(knownMessageKeyOrInternal(error.messageKey));
    return { isApprovalRequired: false, message: msg };
  }
  throw error;
}

export function usePurchaseVerify(args: {
  purchase: CreditPurchaseResponse | undefined;
  organizationId: string;
  isOwner: boolean;
  locations: readonly { locationId: string; name: string }[];
  labels: CreditPurchaseLabels;
  approval: PurchaseApproval;
  onUpdated: () => void;
  setIsBusy: (busy: boolean) => void;
  setErrorMessage: (msg: string | undefined) => void;
}): () => Promise<void> {
  const { t } = useTranslator();
  const {
    purchase,
    organizationId,
    isOwner,
    locations,
    labels,
    approval,
    onUpdated,
    setIsBusy,
    setErrorMessage,
  } = args;

  return async function handleVerify(): Promise<void> {
    if (!purchase) return;
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      await verifyCreditPurchase(organizationId, {
        creditPurchaseId: purchase.creditPurchaseId,
        version: purchase.version,
      });
      onUpdated();
    } catch (error) {
      const parsed = parseVerifyError(error, labels, t);
      if (parsed.isApprovalRequired && !isOwner) {
        const refusal = await approval.open(purchase, locations[0]?.locationId ?? "");
        if (refusal) setErrorMessage(refusal);
      } else {
        setErrorMessage(parsed.message);
      }
    } finally {
      setIsBusy(false);
    }
  };
}
