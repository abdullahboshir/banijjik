"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import {
  type OrderResponse,
  type SalesExchangePreviewResponse,
  type SalesExchangeResponse,
  type SalesExchangePaymentMethod,
  type SalesReturnReason,
} from "@banijjik/contracts/sales";
import { newId } from "@banijjik/ids";
import { useTranslator } from "@banijjik/web-client/client";
import { useRef, useState } from "react";
import { createExchange } from "./exchange-api";
import {
  buildExchangeBody,
  discountApprovalOf,
  exchangeApprovalStepsOf,
  type ExchangeBodyInput,
  type ExchangePaymentDraft,
} from "./exchange-model";
import { failureOf, type RuleFailure } from "./order-failure";
import type { OrderApprovalLabels } from "./order-labels";
import {
  emptyOrderLine,
  lineInputsOfDrafts,
  parseLineDraft,
  parseManualDiscount,
  quoteLinesOf,
  type DiscountTypeChoice,
  type OrderLineDraft,
} from "./order-lines";
import { quoteOrder } from "./order-api";
import {
  ApprovalCancelledError,
  useReturnApprovalFlow,
  type ReturnApprovalFlow,
} from "./return-approval-flow";
import { newSubmitKey } from "./return-api";
import type { ReturnLineDraft } from "./return-model";
import { useReturnForm, type ReturnFormActions, type ReturnFormState } from "./use-return-sheet";

export const EXCHANGE_STEP = {
  RETURN: "RETURN",
  NEW_LINES: "NEW_LINES",
  PAYMENT: "PAYMENT",
} as const;
export type ExchangeStep = (typeof EXCHANGE_STEP)[keyof typeof EXCHANGE_STEP];

export interface ExchangeDiscountDraft {
  readonly type: DiscountTypeChoice;
  readonly text: string;
}

export interface ExchangeFormState {
  readonly returns: ReturnFormState;
  readonly lines: readonly OrderLineDraft[];
  readonly discount: ExchangeDiscountDraft;
  readonly orderNote: string;
  readonly payments: readonly ExchangePaymentDraft[];
  readonly step: ExchangeStep;
}

export interface ExchangeFormActions {
  readonly returns: ReturnFormActions;
  readonly setLines: (lines: readonly OrderLineDraft[]) => void;
  readonly setDiscount: (discount: ExchangeDiscountDraft) => void;
  readonly setOrderNote: (note: string) => void;
  readonly addPayment: (method: SalesExchangePaymentMethod) => void;
  readonly changePayment: (draftId: string, changes: Partial<ExchangePaymentDraft>) => void;
  readonly removePayment: (draftId: string) => void;
  readonly goTo: (step: ExchangeStep) => void;
}

export interface ExchangeFormHook {
  readonly form: ExchangeFormState;
  readonly actions: ExchangeFormActions;
}

/** The plain values an exchange request reads; the form and the request both come from it. */
export interface ExchangeContent {
  readonly drafts: readonly ReturnLineDraft[];
  readonly returnDeliveryCharge: boolean;
  readonly reasonKey: SalesReturnReason | undefined;
  readonly returnNote: string;
  readonly lines: readonly OrderLineDraft[];
  readonly discount: ExchangeDiscountDraft;
  readonly orderNote: string;
  readonly payments: readonly ExchangePaymentDraft[];
}

export function contentOf(form: ExchangeFormState): ExchangeContent {
  return {
    drafts: form.returns.drafts,
    returnDeliveryCharge: form.returns.returnDeliveryCharge,
    reasonKey: form.returns.reasonKey,
    returnNote: form.returns.note,
    lines: form.lines,
    discount: form.discount,
    orderNote: form.orderNote,
    payments: form.payments,
  };
}

/** Every field of the exchange sheet; nothing is sent from here. The return lines reuse the return draft. */
export function useExchangeForm(order: OrderResponse): ExchangeFormHook {
  const returnHook = useReturnForm(order);
  const [lines, setLines] = useState<readonly OrderLineDraft[]>(() => [emptyOrderLine(newId())]);
  const [discount, setDiscount] = useState<ExchangeDiscountDraft>({ type: "NONE", text: "" });
  const [orderNote, setOrderNote] = useState("");
  const [payments, setPayments] = useState<readonly ExchangePaymentDraft[]>([]);
  const [step, setStep] = useState<ExchangeStep>(EXCHANGE_STEP.RETURN);
  return {
    form: { returns: returnHook.form, lines, discount, orderNote, payments, step },
    actions: {
      returns: returnHook.actions,
      setLines,
      setDiscount,
      setOrderNote,
      addPayment: (method) => setPayments((current) => [...current, newPaymentDraft(method)]),
      changePayment: (draftId, changes) =>
        setPayments((current) =>
          current.map((payment) =>
            payment.draftId === draftId ? { ...payment, ...changes } : payment,
          ),
        ),
      removePayment: (draftId) =>
        setPayments((current) => current.filter((payment) => payment.draftId !== draftId)),
      goTo: setStep,
    },
  };
}

function newPaymentDraft(method: SalesExchangePaymentMethod): ExchangePaymentDraft {
  return { draftId: newId(), method, amountText: "", reference: "" };
}

/** The exchange body input from the content; the reason is a placeholder until the staff member picks one. */
export function bodyInputOf(
  content: ExchangeContent,
  currency: CurrencyCode,
  reasonKey: SalesReturnReason,
): ExchangeBodyInput {
  return {
    returnDrafts: content.drafts,
    returnDeliveryCharge: content.returnDeliveryCharge,
    reasonKey,
    returnNote: content.returnNote,
    lineInputs: lineInputsOfDrafts(content.lines),
    orderDiscount: parseManualDiscount(content.discount.type, content.discount.text),
    orderNote: content.orderNote,
    payments: content.payments,
    currency,
  };
}

/** Lines the staff member has not finished (a product picked, quantity or discount still wrong). */
export function invalidLineCountOf(lines: readonly OrderLineDraft[]): number {
  return lines.filter((line) => parseLineDraft(line).kind === "invalid").length;
}

/** The preview is requested once there is a return and at least one valid new line, and no line is half done. */
export interface ExchangeSubmitState {
  readonly isSubmitting: boolean;
  readonly failure: RuleFailure | undefined;
  readonly approvals: ReturnApprovalFlow;
  readonly submit: () => Promise<void>;
}

export interface ExchangeSubmitInput {
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly form: ExchangeFormState;
  readonly currency: CurrencyCode;
  readonly preview: SalesExchangePreviewResponse | undefined;
  readonly approvalLabels: OrderApprovalLabels;
  readonly onCreated: (created: SalesExchangeResponse) => void;
}

/**
 * Asks for the PINs the preview and a fresh quote need, then creates the exchange with one key per
 * submit. A retry of the same body reuses the key, so the server answers with the first exchange.
 */
export function useExchangeSubmit(input: ExchangeSubmitInput): ExchangeSubmitState {
  const { t } = useTranslator();
  const approvals = useReturnApprovalFlow(input.organizationId, input.approvalLabels);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<RuleFailure | undefined>(undefined);
  const keyRef = useRef<{ readonly bodyKey: string; readonly key: string } | undefined>(undefined);

  function keyFor(bodyKey: string): string {
    if (keyRef.current?.bodyKey === bodyKey) return keyRef.current.key;
    const key = newSubmitKey();
    keyRef.current = { bodyKey, key };
    return key;
  }

  async function submit(): Promise<void> {
    const { order, preview, currency } = input;
    const content = contentOf(input.form);
    if (preview === undefined || content.reasonKey === undefined) return;
    setIsSubmitting(true);
    setFailure(undefined);
    try {
      const bodyInput = bodyInputOf(content, currency, content.reasonKey);
      const discount = await discountApprovalFor(input.organizationId, order.locationId, bodyInput);
      const granted = await approvals.collect(exchangeApprovalStepsOf(preview, order, discount));
      const created = await createExchange({
        organizationId: input.organizationId,
        orderId: order.orderId,
        body: buildExchangeBody({ ...bodyInput, granted }),
        idempotencyKey: keyFor(JSON.stringify(buildExchangeBody(bodyInput))),
      });
      input.onCreated(created);
    } catch (error) {
      if (!(error instanceof ApprovalCancelledError)) setFailure(failureOf(error, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  return { isSubmitting, failure, approvals, submit };
}

/** A fresh quote of the new lines: the discount PIN is asked only when the quote says so. */
async function discountApprovalFor(
  organizationId: string,
  locationId: string,
  bodyInput: ExchangeBodyInput,
) {
  const quote = await quoteOrder(organizationId, {
    locationId,
    lines: quoteLinesOf(bodyInput.lineInputs),
    ...(bodyInput.orderDiscount === undefined ? {} : { orderDiscount: bodyInput.orderDiscount }),
  });
  return discountApprovalOf(quote, bodyInput.currency);
}
