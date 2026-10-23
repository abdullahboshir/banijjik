"use client";

import { PAYMENT_DIRECTION, type PaymentResponse } from "@banijjik/contracts/payment";
import { Button } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { PaymentLabels } from "./payment-labels";
import { RefundDialogLazy } from "./refund-dialog-lazy";
import { ReversalDialogLazy } from "./reversal-dialog-lazy";

export interface PaymentDetailActionsProps {
  readonly organizationId: string;
  readonly payment: PaymentResponse;
  readonly canRefund: boolean;
  readonly canReverse: boolean;
  readonly labels: PaymentLabels;
}

function canPerformActions(payment: PaymentResponse): boolean {
  return payment.direction === PAYMENT_DIRECTION.IN && !payment.reversesPaymentId;
}

export function PaymentDetailActions(props: PaymentDetailActionsProps): ReactElement | null {
  const { payment, canRefund, canReverse, labels } = props;
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isReverseOpen, setIsReverseOpen] = useState(false);

  const canAct = canPerformActions(payment);
  const showRefund = canRefund && canAct;
  const showReverse = canReverse && canAct;

  if (!showRefund && !showReverse) return null;

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {showRefund ? (
          <Button type="button" variant="secondary" onClick={() => setIsRefundOpen(true)}>
            {labels.detail.refund}
          </Button>
        ) : null}

        {showReverse ? (
          <Button type="button" variant="danger" onClick={() => setIsReverseOpen(true)}>
            {labels.detail.reverse}
          </Button>
        ) : null}
      </div>

      {isRefundOpen ? (
        <RefundDialogLazy
          open={isRefundOpen}
          onOpenChange={setIsRefundOpen}
          organizationId={props.organizationId}
          payment={payment}
          labels={{
            ...labels.refundDialog,
            methodLabels: labels.method,
            requestTypeLabels: labels.requestType,
            cancelLabel: labels.refundDialog.cancel,
            closeLabel: labels.refundDialog.cancel,
            lockedMessage: labels.refundDialog.approvalLocked,
          }}
        />
      ) : null}

      {isReverseOpen ? (
        <ReversalDialogLazy
          open={isReverseOpen}
          onOpenChange={setIsReverseOpen}
          organizationId={props.organizationId}
          payment={payment}
          labels={{
            ...labels.reversalDialog,
            cancelLabel: labels.reversalDialog.cancel,
            closeLabel: labels.reversalDialog.cancel,
            lockedMessage: labels.reversalDialog.approvalLocked,
          }}
        />
      ) : null}
    </>
  );
}
