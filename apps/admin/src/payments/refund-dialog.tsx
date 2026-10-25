"use client";

import {
  PAYMENT_METHOD,
  type Money,
  type PaymentAllocation,
  type PaymentMethod,
  type PaymentRequestType,
  type PaymentResponse,
} from "@banijjik/contracts/payment";
import {
  ApprovalPinDialog,
  FormField,
  Sheet,
  SheetContent,
  TextInput,
  parseMoneyInput,
} from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { PaymentLabels } from "./payment-labels";
import { RefundAllocationsList, buildRefundAllocations } from "./refund-allocations";
import { RefundFooterActions, RefundMethodAndRefFields } from "./refund-dialog-fields";
import { minorUnitsToDecimal } from "./receive-payment-allocations";
import { useRefundFlow, type RefundFlowState } from "./use-refund-flow";

/**
 * What the refund returns money for. A payment answers it as a whole; an enrollment period of a
 * cancelled enrollment answers it with that period as its only allocation (3.32 Part B).
 */
export interface RefundTarget {
  readonly locationId: string;
  readonly contactId?: string | null;
  readonly method: PaymentMethod;
  readonly amount: Money;
  readonly allocations: readonly PaymentAllocation[];
}

export interface RefundDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly payment: RefundTarget;
  /** The most this refund may give back; a larger amount is refused before sending. */
  readonly maxAmount?: Money | undefined;
  readonly onSuccess?: ((refundedPayment: PaymentResponse) => void) | undefined;
  readonly labels: PaymentLabels["refundDialog"] & {
    readonly methodLabels: Readonly<Record<PaymentMethod, string>>;
    readonly cancelLabel: string;
    readonly closeLabel: string;
    readonly lockedMessage: string;
    readonly requestTypeLabels?: Readonly<Record<PaymentRequestType, string>> | undefined;
  };
}

export type RefundDialogLabels = RefundDialogProps["labels"];

export function isAboveRefundLimit(amount: Money, limit: Money | undefined): boolean {
  if (!limit) return false;
  if (amount.currency !== limit.currency) return true;
  return amount.amount > limit.amount;
}

function resolveDefaultRefundMethod(paymentMethod: PaymentMethod): PaymentMethod {
  if (
    paymentMethod === PAYMENT_METHOD.BKASH ||
    paymentMethod === PAYMENT_METHOD.NAGAD ||
    paymentMethod === PAYMENT_METHOD.STORE_CREDIT
  ) {
    return paymentMethod;
  }
  return PAYMENT_METHOD.CASH;
}

interface RefundFormProps {
  readonly payment: RefundTarget;
  readonly maxAmount: Money | undefined;
  readonly labels: RefundDialogProps["labels"];
  readonly refundFlow: RefundFlowState;
  readonly onCancel: () => void;
}

/** One allocation follows the refund amount; several of them are edited on their own rows. */
function useRefundAllocationAmounts(payment: RefundTarget, amountMinor: number) {
  const [amounts, setAmounts] = useState<readonly number[]>(() =>
    payment.allocations.map((allocation) => allocation.amount.amount),
  );

  function handleChange(index: number, newMinor: number): void {
    setAmounts((prev) => prev.map((value, position) => (position === index ? newMinor : value)));
  }

  return {
    effective: payment.allocations.length === 1 ? ([amountMinor] as const) : amounts,
    handleChange,
  };
}

function useRefundFormState(
  payment: RefundTarget,
  refundFlow: RefundFlowState,
  maxAmount: Money | undefined,
) {
  const [method, setMethod] = useState<PaymentMethod>(resolveDefaultRefundMethod(payment.method));
  const [amountText, setAmountText] = useState<string>(() =>
    minorUnitsToDecimal(payment.amount.amount),
  );
  const [externalReference, setExternalReference] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const parsedAmount = parseMoneyInput(amountText, 2)?.minorUnits ?? 0;
  const amount = { amount: parsedAmount, currency: payment.amount.currency };
  const isMobileMoney = method === PAYMENT_METHOD.BKASH || method === PAYMENT_METHOD.NAGAD;
  const isAboveMaximum = isAboveRefundLimit(amount, maxAmount);
  const allocations = useRefundAllocationAmounts(payment, parsedAmount);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (parsedAmount <= 0 || isAboveMaximum) return;
    await refundFlow.executeRefund({
      locationId: payment.locationId,
      method,
      amount,
      externalReference: isMobileMoney ? externalReference.trim() : null,
      allocations: buildRefundAllocations({
        allocations: payment.allocations,
        parsedAmount,
        allocationAmounts: allocations.effective,
        currency: payment.amount.currency,
      }),
      contactId: payment.contactId ?? null,
      note: note.trim() || null,
    });
  }

  return {
    method,
    setMethod,
    amountText,
    setAmountText,
    externalReference,
    setExternalReference,
    note,
    setNote,
    allocationAmounts: allocations.effective,
    handleAllocChange: allocations.handleChange,
    parsedAmount,
    isMobileMoney,
    isAboveMaximum,
    handleSubmit,
  };
}

function RefundForm(props: RefundFormProps): ReactElement {
  const { payment, maxAmount, labels, refundFlow, onCancel } = props;
  const form = useRefundFormState(payment, refundFlow, maxAmount);

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)} className="flex flex-col gap-4 py-2">
      <RefundMethodAndRefFields
        method={form.method}
        isMobileMoney={form.isMobileMoney}
        externalReference={form.externalReference}
        disabled={refundFlow.isSubmitting}
        methodLabel={labels.method}
        referenceLabel={labels.reference}
        methodLabels={labels.methodLabels}
        onMethodChange={form.setMethod}
        onReferenceChange={form.setExternalReference}
      />
      <FormField label={`${labels.amount} (${payment.amount.currency})`} htmlFor="refund-amount">
        <TextInput
          id="refund-amount"
          inputMode="decimal"
          value={form.amountText}
          onChange={(e) => form.setAmountText(e.target.value)}
          disabled={refundFlow.isSubmitting}
        />
      </FormField>
      {form.isAboveMaximum ? (
        <p className="text-caption text-error">{labels.invalidAmount}</p>
      ) : null}
      <RefundAllocationsList
        allocations={payment.allocations}
        allocationAmounts={form.allocationAmounts}
        label={labels.allocations}
        disabled={refundFlow.isSubmitting}
        requestTypeLabels={labels.requestTypeLabels}
        invalidAmountLabel={labels.invalidAmount}
        onChange={form.handleAllocChange}
      />
      <FormField label={labels.note} htmlFor="refund-note">
        <TextInput
          id="refund-note"
          value={form.note}
          onChange={(e) => form.setNote(e.target.value)}
          disabled={refundFlow.isSubmitting}
        />
      </FormField>
      <RefundFooterActions
        errorMessage={refundFlow.errorMessage}
        isSubmitting={refundFlow.isSubmitting}
        disabled={refundFlow.isSubmitting || form.parsedAmount <= 0 || form.isAboveMaximum}
        cancelLabel={labels.cancel}
        submitLabel={labels.submit}
        onCancel={onCancel}
      />
    </form>
  );
}

export function RefundDialog(props: RefundDialogProps): ReactElement {
  const router = useRouter();
  const { payment, maxAmount, labels } = props;

  const refundFlow = useRefundFlow({
    organizationId: props.organizationId,
    noApproversMessage: labels.noApprovers,
    failedMessage: labels.failed,
    approvalFailedMessage: labels.approvalFailed,
    loadApproversFailedMessage: labels.loadApproversFailed,
    onSuccess: (res) => {
      props.onSuccess?.(res);
      router.refresh();
      props.onOpenChange(false);
    },
  });

  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent title={labels.title} closeLabel={labels.cancel}>
          <RefundForm
            payment={payment}
            maxAmount={maxAmount}
            labels={labels}
            refundFlow={refundFlow}
            onCancel={() => props.onOpenChange(false)}
          />
        </SheetContent>
      </Sheet>

      {refundFlow.showApprovalDialog && refundFlow.approvers.length > 0 ? (
        <ApprovalPinDialog
          key={refundFlow.approvers[0]?.memberId ?? "approval"}
          open={refundFlow.showApprovalDialog}
          onOpenChange={refundFlow.closeApprovalDialog}
          title={labels.approvalTitle}
          approverLabel={labels.approver}
          pinLabel={labels.pin}
          submitLabel={labels.submit}
          cancelLabel={labels.cancel}
          closeLabel={labels.closeLabel}
          lockedMessage={labels.lockedMessage}
          approvers={refundFlow.approvers.map((a) => ({
            memberId: a.memberId,
            displayName: a.displayName,
            hasPin: true,
          }))}
          {...(refundFlow.approvalError ? { errorMessage: refundFlow.approvalError } : {})}
          isLocked={refundFlow.isPinLocked}
          isSubmitting={refundFlow.isApproving}
          onSubmit={(input) => void refundFlow.handleApprovalSubmit(input)}
        />
      ) : null}
    </>
  );
}
