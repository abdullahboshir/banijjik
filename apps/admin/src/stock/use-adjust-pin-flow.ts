"use client";

import type { StockAdjustmentBody } from "@banijjik/validation/inventory";
import { useRef, useState } from "react";
import { postStockAdjustment } from "./build-adjust-stock-send";
import { runAdjustApproval } from "./run-adjust-approval";
import { listApprovers } from "./stock-api";

export function useAdjustPinFlow(props: {
  organizationId: string;
  onSuccess?: () => void;
  onClose?: () => void;
}): {
  pinOpen: boolean;
  setPinOpen: (open: boolean) => void;
  approvers: Awaited<ReturnType<typeof listApprovers>>;
  approvalError: string | undefined;
  isGranting: boolean;
  onApproval: (input: { approverMemberId: string; pin: string }) => Promise<void>;
  openForApproval: (
    body: StockAdjustmentBody,
    listed: Awaited<ReturnType<typeof listApprovers>>,
  ) => void;
  bindReload: (reload: () => void) => void;
} {
  const reloadRef = useRef<() => void>(() => undefined);
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingBody, setPendingBody] = useState<StockAdjustmentBody | undefined>();
  const [approvers, setApprovers] = useState<Awaited<ReturnType<typeof listApprovers>>>([]);
  const [approvalError, setApprovalError] = useState<string | undefined>();
  const [isGranting, setIsGranting] = useState(false);

  function openForApproval(
    body: StockAdjustmentBody,
    listed: Awaited<ReturnType<typeof listApprovers>>,
  ): void {
    setPendingBody(body);
    setApprovers(listed);
    setPinOpen(true);
  }

  async function onApproval(input: { approverMemberId: string; pin: string }): Promise<void> {
    if (pendingBody === undefined) return;
    setIsGranting(true);
    setApprovalError(undefined);
    const result = await runAdjustApproval({
      organizationId: props.organizationId,
      pendingBody,
      input,
      postAdjustment: (body) => postStockAdjustment(props.organizationId, body),
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
