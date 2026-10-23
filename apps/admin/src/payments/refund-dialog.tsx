"use client";

import {
  ACCEPTED_PAYMENT_METHODS,
  PAYMENT_METHOD,
  type PaymentMethod,
  type PaymentRequestType,
  type PaymentResponse,
} from "@banijjik/contracts/payment";
import {
  ApprovalPinDialog,
  Button,
  FormField,
  Select,
  Sheet,
  SheetContent,
  TextInput,
  parseMoneyInput,
} from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import type { PaymentLabels } from "./payment-labels";
import { RefundAllocationsList, buildRefundAllocations } from "./refund-allocations";
import { minorUnitsToDecimal } from "./receive-payment-allocations";
import { useRefundFlow, type RefundFlowState } from "./use-refund-flow";

export interface RefundDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly payment: PaymentResponse;
  readonly onSuccess?: ((refundedPayment: PaymentResponse) => void) | undefined;
  readonly labels: PaymentLabels["refundDialog"] & {
    readonly methodLabels: Readonly<Record<PaymentMethod, string>>;
    readonly cancelLabel: string;
    readonly closeLabel: string;
    readonly lockedMessage: string;
    readonly requestTypeLabels?: Readonly<Record<PaymentRequestType, string>> | undefined;
  };
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
  readonly payment: PaymentResponse;
  readonly labels: RefundDialogProps["labels"];
  readonly refundFlow: RefundFlowState;
  readonly onCancel: () => void;
}

interface RefundMethodAndRefProps {
  readonly method: PaymentMethod;
  readonly isMobileMoney: boolean;
  readonly externalReference: string;
  readonly disabled: boolean;
  readonly labels: RefundDialogProps["labels"];
  readonly onMethodChange: (m: PaymentMethod) => void;
  readonly onReferenceChange: (ref: string) => void;
}

function RefundMethodAndRefFields(props: RefundMethodAndRefProps): ReactElement {
  const {
    method,
    isMobileMoney,
    externalReference,
    disabled,
    labels,
    onMethodChange,
    onReferenceChange,
  } = props;
  return (
    <>
      <FormField label={labels.method} htmlFor="refund-method">
        <Select
          id="refund-method"
          value={method}
          onChange={(e) => onMethodChange(e.target.value as PaymentMethod)}
          disabled={disabled}
        >
          {ACCEPTED_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {labels.methodLabels[m] ?? m}
            </option>
          ))}
        </Select>
      </FormField>
      {isMobileMoney ? (
        <FormField label={labels.reference} htmlFor="refund-reference">
          <TextInput
            id="refund-reference"
            value={externalReference}
            onChange={(e) => onReferenceChange(e.target.value)}
            disabled={disabled}
          />
        </FormField>
      ) : null}
    </>
  );
}

function RefundFooterActions(props: {
  readonly errorMessage?: string | undefined;
  readonly isSubmitting: boolean;
  readonly disabled: boolean;
  readonly cancelLabel: string;
  readonly submitLabel: string;
  readonly onCancel: () => void;
}): ReactElement {
  const { errorMessage, isSubmitting, disabled, cancelLabel, submitLabel, onCancel } = props;
  return (
    <>
      {errorMessage ? <p className="text-body-sm text-error">{errorMessage}</p> : null}
      <div className="flex justify-end gap-2 pt-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          {cancelLabel}
        </Button>
        <Button type="submit" isLoading={isSubmitting} disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </>
  );
}

function useRefundFormState(payment: PaymentResponse, refundFlow: RefundFlowState) {
  const [method, setMethod] = useState<PaymentMethod>(resolveDefaultRefundMethod(payment.method));
  const [amountText, setAmountText] = useState<string>(() =>
    minorUnitsToDecimal(payment.amount.amount),
  );
  const [externalReference, setExternalReference] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [allocationAmounts, setAllocationAmounts] = useState<readonly number[]>(() =>
    payment.allocations.map((a) => a.amount.amount),
  );

  const parsedAmount = parseMoneyInput(amountText, 2)?.minorUnits ?? 0;
  const isMobileMoney = method === PAYMENT_METHOD.BKASH || method === PAYMENT_METHOD.NAGAD;

  function handleAllocChange(index: number, newMinor: number): void {
    setAllocationAmounts((prev) => {
      const copy = [...prev];
      copy[index] = newMinor;
      return copy;
    });
  }

  function handleAmountChange(value: string): void {
    setAmountText(value);
    const parsed = parseMoneyInput(value, 2)?.minorUnits ?? 0;
    if (payment.allocations.length === 1) setAllocationAmounts([parsed]);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (parsedAmount <= 0) return;
    const allocations = buildRefundAllocations({
      allocations: payment.allocations,
      parsedAmount,
      allocationAmounts,
      currency: payment.amount.currency,
    });
    await refundFlow.executeRefund({
      locationId: payment.locationId,
      method,
      amount: { amount: parsedAmount, currency: payment.amount.currency },
      externalReference: isMobileMoney ? externalReference.trim() : null,
      allocations,
      contactId: payment.contactId ?? null,
      note: note.trim() || null,
    });
  }

  return {
    method,
    setMethod,
    amountText,
    handleAmountChange,
    externalReference,
    setExternalReference,
    note,
    setNote,
    allocationAmounts,
    handleAllocChange,
    parsedAmount,
    isMobileMoney,
    handleSubmit,
  };
}

function RefundForm(props: RefundFormProps): ReactElement {
  const { payment, labels, refundFlow, onCancel } = props;
  const form = useRefundFormState(payment, refundFlow);

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)} className="flex flex-col gap-4 py-2">
      <RefundMethodAndRefFields
        method={form.method}
        isMobileMoney={form.isMobileMoney}
        externalReference={form.externalReference}
        disabled={refundFlow.isSubmitting}
        labels={labels}
        onMethodChange={form.setMethod}
        onReferenceChange={form.setExternalReference}
      />
      <FormField label={`${labels.amount} (${payment.amount.currency})`} htmlFor="refund-amount">
        <TextInput
          id="refund-amount"
          inputMode="decimal"
          value={form.amountText}
          onChange={(e) => form.handleAmountChange(e.target.value)}
          disabled={refundFlow.isSubmitting}
        />
      </FormField>
      <RefundAllocationsList
        allocations={payment.allocations}
        allocationAmounts={form.allocationAmounts}
        label={labels.allocations}
        disabled={refundFlow.isSubmitting}
        requestTypeLabels={labels.requestTypeLabels}
        invalidAmountLabel={labels.failed}
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
        disabled={refundFlow.isSubmitting || form.parsedAmount <= 0}
        cancelLabel={labels.cancel}
        submitLabel={labels.submit}
        onCancel={onCancel}
      />
    </form>
  );
}

export function RefundDialog(props: RefundDialogProps): ReactElement {
  const router = useRouter();
  const { payment, labels } = props;

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
