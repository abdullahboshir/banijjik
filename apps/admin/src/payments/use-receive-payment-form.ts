"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import {
  PAYMENT_METHOD,
  type PaymentAllocation,
  type PaymentMethod,
  type PaymentResponse,
} from "@banijjik/contracts/payment";
import { parseMoneyInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "../lib/api/api-error";
import { receivePayment } from "./payment-api";
import type { AllocationDraft } from "./receive-payment-allocations";
import type { BusinessAccountInfo, ReceivePaymentSheetProps } from "./receive-payment-sheet";

function resolveInitialAmount(props: ReceivePaymentSheetProps): string {
  if (props.initialDueMinor) return String(props.initialDueMinor / 100);
  const alloc = props.initialAllocations?.[0];
  return alloc ? String(alloc.amount.amount / 100) : "";
}

function resolveDefaultMethod(allowed: readonly PaymentMethod[]): PaymentMethod {
  return allowed.find((m) => m === PAYMENT_METHOD.CASH) ?? allowed[0] ?? PAYMENT_METHOD.CASH;
}

function resolveBusinessNumber(
  method: PaymentMethod,
  numbers?: ReceivePaymentSheetProps["businessNumbers"],
): BusinessAccountInfo | undefined {
  if (method === PAYMENT_METHOD.BKASH) return numbers?.bkash;
  if (method === PAYMENT_METHOD.NAGAD) return numbers?.nagad;
  return undefined;
}

function validateInput(opts: {
  readonly parsedAmount: number;
  readonly locationId: string;
  readonly isMobileMoney: boolean;
  readonly externalReference: string;
  readonly overpaymentRequiresContact: boolean;
  readonly refRequiredMsg: string;
  readonly overpaymentMsg: string;
}): string | undefined {
  if (opts.parsedAmount <= 0) return "Amount must be greater than zero";
  if (!opts.locationId) return "Location is required";
  if (opts.isMobileMoney && !opts.externalReference.trim()) return opts.refRequiredMsg;
  if (opts.overpaymentRequiresContact) return opts.overpaymentMsg;
  return undefined;
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) return error.messageKey;
  if (error instanceof Error) return error.message;
  return "Payment failed";
}

async function executeReceivePayment(opts: {
  readonly organizationId: string;
  readonly locationId: string;
  readonly method: PaymentMethod;
  readonly parsedAmount: number;
  readonly currency: CurrencyCode;
  readonly isMobileMoney: boolean;
  readonly externalReference: string;
  readonly allocations: readonly AllocationDraft[];
  readonly contactId: string;
  readonly note: string;
}): Promise<PaymentResponse> {
  const paymentAllocations: PaymentAllocation[] = opts.allocations.map((a) => ({
    requestType: a.requestType,
    requestId: a.requestId,
    amount: { amount: a.amountMinor, currency: opts.currency },
  }));
  return receivePayment(opts.organizationId, {
    locationId: opts.locationId,
    method: opts.method,
    amount: { amount: opts.parsedAmount, currency: opts.currency },
    externalReference: opts.isMobileMoney ? opts.externalReference.trim() : null,
    allocations: paymentAllocations,
    contactId: opts.contactId.trim() || null,
    note: opts.note.trim() || null,
  });
}

function useReceivePaymentFields(props: ReceivePaymentSheetProps) {
  const [locationId, setLocationId] = useState<string>(
    props.initialLocationId ?? props.locations[0]?.locationId ?? "",
  );
  const [method, setMethod] = useState<PaymentMethod>(resolveDefaultMethod(props.allowedMethods));
  const [amountText, setAmountText] = useState<string>(() => resolveInitialAmount(props));
  const [externalReference, setExternalReference] = useState<string>("");
  const [contactId, setContactId] = useState<string>(props.initialContactId ?? "");
  const [note, setNote] = useState<string>("");
  const [allocations, setAllocations] = useState<readonly AllocationDraft[]>(() =>
    (props.initialAllocations ?? []).map((a) => ({
      requestType: a.requestType,
      requestId: a.requestId,
      amountMinor: a.amount.amount,
    })),
  );

  function handleAllocChange(idx: number, minor: number): void {
    setAllocations((prev) => {
      const copy = [...prev];
      const target = copy[idx];
      if (target) copy[idx] = { ...target, amountMinor: minor };
      return copy;
    });
  }

  return {
    locationId,
    setLocationId,
    method,
    setMethod,
    amountText,
    setAmountText,
    externalReference,
    setExternalReference,
    contactId,
    setContactId,
    note,
    setNote,
    allocations,
    handleAllocChange,
  };
}

function computeOverpayment(opts: {
  readonly parsedAmount: number;
  readonly allocations: readonly AllocationDraft[];
  readonly method: PaymentMethod;
  readonly contactId: string;
}) {
  const totalAllocated = opts.allocations.reduce((sum, a) => sum + a.amountMinor, 0);
  const overpaymentMinor = Math.max(0, opts.parsedAmount - totalAllocated);
  const hasOverpayment = overpaymentMinor > 0;
  const overpaymentRequiresContact =
    hasOverpayment && opts.method !== PAYMENT_METHOD.CASH && !opts.contactId.trim();
  return { overpaymentMinor, hasOverpayment, overpaymentRequiresContact };
}

async function executeFormSubmit(opts: {
  readonly props: ReceivePaymentSheetProps;
  readonly fields: ReturnType<typeof useReceivePaymentFields>;
  readonly parsedAmount: number;
  readonly isMobileMoney: boolean;
  readonly overpaymentRequiresContact: boolean;
  readonly setIsSubmitting: (v: boolean) => void;
  readonly setErrorMessage: (v: string | undefined) => void;
  readonly setSuccessMessage: (v: string | undefined) => void;
  readonly routerRefresh: () => void;
}): Promise<void> {
  const err = validateInput({
    parsedAmount: opts.parsedAmount,
    locationId: opts.fields.locationId,
    isMobileMoney: opts.isMobileMoney,
    externalReference: opts.fields.externalReference,
    overpaymentRequiresContact: opts.overpaymentRequiresContact,
    refRequiredMsg: opts.props.labels.referenceRequired,
    overpaymentMsg: opts.props.labels.overpaymentError,
  });
  if (err) {
    opts.setErrorMessage(err);
    return;
  }
  opts.setIsSubmitting(true);
  try {
    const payment = await executeReceivePayment({
      organizationId: opts.props.organizationId,
      locationId: opts.fields.locationId,
      method: opts.fields.method,
      parsedAmount: opts.parsedAmount,
      currency: opts.props.currency,
      isMobileMoney: opts.isMobileMoney,
      externalReference: opts.fields.externalReference,
      allocations: opts.fields.allocations,
      contactId: opts.fields.contactId,
      note: opts.fields.note,
    });
    opts.setSuccessMessage(opts.props.labels.success);
    opts.props.onSuccess?.(payment);
    opts.routerRefresh();
    setTimeout(() => opts.props.onOpenChange(false), 600);
  } catch (error) {
    opts.setErrorMessage(formatError(error));
  } finally {
    opts.setIsSubmitting(false);
  }
}

export interface ReceivePaymentFormResult {
  readonly locationId: string;
  readonly setLocationId: (id: string) => void;
  readonly method: PaymentMethod;
  readonly setMethod: (m: PaymentMethod) => void;
  readonly amountText: string;
  readonly setAmountText: (t: string) => void;
  readonly externalReference: string;
  readonly setExternalReference: (r: string) => void;
  readonly contactId: string;
  readonly setContactId: (c: string) => void;
  readonly note: string;
  readonly setNote: (n: string) => void;
  readonly allocations: readonly AllocationDraft[];
  readonly handleAllocChange: (idx: number, minor: number) => void;
  readonly parsedAmount: number;
  readonly overpaymentMinor: number;
  readonly hasOverpayment: boolean;
  readonly isMobileMoney: boolean;
  readonly businessNumber?: BusinessAccountInfo | undefined;
  readonly overpaymentRequiresContact: boolean;
  readonly isSubmitting: boolean;
  readonly errorMessage: string | undefined;
  readonly successMessage: string | undefined;
  readonly handleSubmit: (e: React.FormEvent) => Promise<void>;
}

export function useReceivePaymentForm(props: ReceivePaymentSheetProps): ReceivePaymentFormResult {
  const router = useRouter();
  const fields = useReceivePaymentFields(props);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();

  const parsedAmount = parseMoneyInput(fields.amountText, 2)?.minorUnits ?? 0;
  const isMobileMoney =
    fields.method === PAYMENT_METHOD.BKASH || fields.method === PAYMENT_METHOD.NAGAD;
  const businessNumber = resolveBusinessNumber(fields.method, props.businessNumbers);
  const { overpaymentMinor, hasOverpayment, overpaymentRequiresContact } = computeOverpayment({
    parsedAmount,
    allocations: fields.allocations,
    method: fields.method,
    contactId: fields.contactId,
  });

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErrorMessage(undefined);
    setSuccessMessage(undefined);
    await executeFormSubmit({
      props,
      fields,
      parsedAmount,
      isMobileMoney,
      overpaymentRequiresContact,
      setIsSubmitting,
      setErrorMessage,
      setSuccessMessage,
      routerRefresh: () => router.refresh(),
    });
  }

  return {
    ...fields,
    parsedAmount,
    overpaymentMinor,
    hasOverpayment,
    isMobileMoney,
    businessNumber,
    overpaymentRequiresContact,
    isSubmitting,
    errorMessage,
    successMessage,
    handleSubmit,
  };
}
