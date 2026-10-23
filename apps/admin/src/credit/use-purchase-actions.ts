"use client";

import type { CreditPurchaseResponse } from "@banijjik/contracts/credit";
import { useState } from "react";
import type { CreditPurchaseLabels } from "./credit-purchase-labels";
import { usePurchaseApproval, type PurchaseApproval } from "./use-purchase-approval";
import { usePurchaseReject } from "./use-purchase-reject";
import { usePurchaseVerify } from "./use-purchase-verify";

export interface PurchaseActionsProps {
  purchase: CreditPurchaseResponse | undefined;
  organizationId: string;
  isOwner: boolean;
  locations: readonly { locationId: string; name: string }[];
  labels: CreditPurchaseLabels;
  onUpdated: () => void;
}

export interface PurchaseActions {
  isBusy: boolean;
  errorMessage: string | undefined;
  rejecting: boolean;
  rejectReason: string;
  approval: PurchaseApproval;
  setRejecting: (rejecting: boolean) => void;
  setRejectReason: (reason: string) => void;
  handleVerify: () => Promise<void>;
  handleReject: () => Promise<void>;
}

export function usePurchaseActions(props: PurchaseActionsProps): PurchaseActions {
  const { purchase, organizationId, isOwner, locations, labels, onUpdated } = props;
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const approval = usePurchaseApproval({
    organizationId,
    noApproversLabel: labels.noApprovers,
    onVerified: () => {
      setErrorMessage(undefined);
      onUpdated();
    },
  });

  const handleVerify = usePurchaseVerify({
    purchase,
    organizationId,
    isOwner,
    locations,
    labels,
    approval,
    onUpdated,
    setIsBusy,
    setErrorMessage,
  });

  const handleReject = usePurchaseReject({
    purchase,
    organizationId,
    rejectReason,
    labels,
    onUpdated,
    setIsBusy,
    setRejecting,
    setErrorMessage,
  });

  return {
    isBusy,
    errorMessage,
    rejecting,
    rejectReason,
    approval,
    setRejecting,
    setRejectReason,
    handleVerify,
    handleReject,
  };
}
