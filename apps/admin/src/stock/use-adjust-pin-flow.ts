"use client";

import type { StockAdjustmentBody } from "@banijjik/validation/inventory";
import { useRef, useState } from "react";
import { postStockAdjustment } from "./build-adjust-stock-send";
import { runAdjustApproval } from "./run-adjust-approval";
import { listApprovers } from "./stock-api";

type ApproverList = Awaited<ReturnType<typeof listApprovers>>;

export interface AdjustPinFlow {
  pinOpen: boolean;
  setPinOpen: (open: boolean) => void;
  approvers: ApproverList;
  approvalError: string | undefined;
  isGranting: boolean;
  onApproval: (input: { approverMemberId: string; pin: string }) => Promise<void>;
  openForApproval: (body: StockAdjustmentBody, listed: ApproverList) => void;
  bindReload: (reload: () => void) => void;
}

async function grantPendingAdjustment(input: {
  organizationId: string;
  pendingBody: StockAdjustmentBody;
  pin: { approverMemberId: string; pin: string };
}): Promise<{ ok: true } | { ok: false; errorKey: string }> {
  return runAdjustApproval({
    organizationId: input.organizationId,
    pendingBody: input.pendingBody,
    input: input.pin,
    postAdjustment: (body) => postStockAdjustment(input.organizationId, body),
  });
}

export function useAdjustPinFlow(props: {
  organizationId: string;
  onSuccess?: () => void;
  onClose?: () => void;
}): AdjustPinFlow {
  const reloadRef = useRef<() => void>(() => undefined);
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingBody, setPendingBody] = useState<StockAdjustmentBody | undefined>();
  const [approvers, setApprovers] = useState<ApproverList>([]);
  const [approvalError, setApprovalError] = useState<string | undefined>();
  const [isGranting, setIsGranting] = useState(false);

  function openForApproval(body: StockAdjustmentBody, listed: ApproverList): void {
    setPendingBody(body);
    setApprovers(listed);
    setPinOpen(true);
  }

  async function onApproval(pin: { approverMemberId: string; pin: string }): Promise<void> {
    if (pendingBody === undefined) return;
    setIsGranting(true);
    setApprovalError(undefined);
    const result = await grantPendingAdjustment({
      organizationId: props.organizationId,
      pendingBody,
      pin,
    });
    setIsGranting(false);
    if (!result.ok) {
      setApprovalError(result.errorKey);
      return;
    }
    setPinOpen(false);
    setPendingBody(undefined);
    props.onSuccess?.();
    if (props.onClose) props.onClose();
    else reloadRef.current();
  }

  return {
    pinOpen,
    setPinOpen,
    approvers,
    approvalError,
    isGranting,
    onApproval,
    openForApproval,
    bindReload: (reload) => {
      reloadRef.current = reload;
    },
  };
}
