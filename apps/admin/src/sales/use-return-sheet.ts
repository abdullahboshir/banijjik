"use client";

import type { PaymentMethod } from "@banijjik/contracts/payment";
import {
  type OrderResponse,
  type ReturnDisposition,
  type SalesReturnPreviewResponse,
  type SalesReturnReason,
  type SalesReturnResponse,
} from "@banijjik/contracts/sales";
import { useTranslator } from "@banijjik/web-client/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { failureOf, type RuleFailure } from "./order-failure";
import type { OrderApprovalLabels } from "./order-labels";
import type { SalesReturnRequestBody } from "@banijjik/validation/sales";
import { createReturn, newSubmitKey, previewReturn } from "./return-api";
import {
  ApprovalCancelledError,
  useReturnApprovalFlow,
  type ReturnApprovalFlow,
} from "./return-approval-flow";
import {
  PREVIEW_PLACEHOLDER_METHOD,
  PREVIEW_PLACEHOLDER_REASON,
  approvalTokensOf,
  buildReturnBody,
  pickedReturnLines,
  reasonNeedsNote,
  returnApprovalStepsOf,
  returnDraftsOf,
  withReturnDisposition,
  withReturnQuantity,
  type ReturnLineDraft,
} from "./return-model";

export type ReturnBlocker = "NO_LINES" | "REASON" | "NOTE" | "REFUND_METHOD";

export type ReturnPreviewState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly preview: SalesReturnPreviewResponse };

export interface ReturnFormState {
  readonly drafts: readonly ReturnLineDraft[];
  readonly returnDeliveryCharge: boolean;
  readonly reasonKey: SalesReturnReason | undefined;
  readonly note: string;
  readonly refundMethod: PaymentMethod | null;
  readonly refundReference: string;
}

export interface ReturnFormActions {
  readonly setQuantity: (orderLineId: string, quantity: number) => void;
  readonly setDisposition: (orderLineId: string, disposition: ReturnDisposition) => void;
  readonly setReturnDeliveryCharge: (value: boolean) => void;
  readonly setReasonKey: (reasonKey: SalesReturnReason | undefined) => void;
  readonly setNote: (note: string) => void;
  readonly setRefundMethod: (method: PaymentMethod | null) => void;
  readonly setRefundReference: (reference: string) => void;
}

/** The draft of the return sheet: the picked lines and the fields. Nothing is sent from here. */
export function useReturnForm(order: OrderResponse): {
  readonly form: ReturnFormState;
  readonly actions: ReturnFormActions;
} {
  const [drafts, setDrafts] = useState<readonly ReturnLineDraft[]>(() => returnDraftsOf(order));
  const [returnDeliveryCharge, setReturnDeliveryCharge] = useState(false);
  const [reasonKey, setReasonKey] = useState<SalesReturnReason | undefined>(undefined);
  const [note, setNote] = useState("");
  const [refundMethod, setRefundMethod] = useState<PaymentMethod | null>(null);
  const [refundReference, setRefundReference] = useState("");
  return {
    form: { drafts, returnDeliveryCharge, reasonKey, note, refundMethod, refundReference },
    actions: {
      setQuantity: (orderLineId, quantity) =>
        setDrafts((current) => withReturnQuantity(current, orderLineId, quantity)),
      setDisposition: (orderLineId, disposition) =>
        setDrafts((current) => withReturnDisposition(current, orderLineId, disposition)),
      setReturnDeliveryCharge,
      setReasonKey,
      setNote,
      setRefundMethod,
      setRefundReference,
    },
  };
}

/**
 * The server preview of the picked lines. It is requested with placeholder reason and method when
 * the staff member has not chosen yet: neither changes an amount, and the server refuses a refund
 * without a method, so the amounts would otherwise never show.
 */
export function useReturnPreview(input: {
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly form: ReturnFormState;
}): ReturnPreviewState {
  const { form, order, organizationId } = input;
  const previewBody = useMemo(
    () =>
      buildReturnBody({
        drafts: form.drafts,
        returnDeliveryCharge: form.returnDeliveryCharge,
        refundMethod: form.refundMethod ?? PREVIEW_PLACEHOLDER_METHOD,
        refundExternalReference: "",
        reasonKey: form.reasonKey ?? PREVIEW_PLACEHOLDER_REASON,
        note: "",
      }),
    [form.drafts, form.returnDeliveryCharge, form.refundMethod, form.reasonKey],
  );
  const [state, setState] = useState<ReturnPreviewState>({ status: "idle" });
  useEffect(() => {
    if (previewBody.lines.length === 0) {
      setState({ status: "idle" });
      return undefined;
    }
    let isCurrent = true;
    setState({ status: "loading" });
    async function loadPreview(): Promise<void> {
      try {
        const preview = await previewReturn(organizationId, order.orderId, previewBody);
        if (isCurrent) setState({ status: "ready", preview });
      } catch {
        if (isCurrent) setState({ status: "failed" });
      }
    }
    void loadPreview();
    return () => {
      isCurrent = false;
    };
  }, [organizationId, order.orderId, previewBody]);
  return state;
}

/** The blocker that stops the submit before any request goes out; the sheet names it next to the button. */
export function returnBlockerOf(
  form: ReturnFormState,
  preview: SalesReturnPreviewResponse | undefined,
): ReturnBlocker | undefined {
  if (pickedReturnLines(form.drafts).length === 0) return "NO_LINES";
  if (form.reasonKey === undefined) return "REASON";
  if (reasonNeedsNote(form.reasonKey, form.note)) return "NOTE";
  if (preview !== undefined && preview.refundAmount.amount > 0 && form.refundMethod === null) {
    return "REFUND_METHOD";
  }
  return undefined;
}

/** The request body without approval tokens: one idempotency key covers every retry of the same body. */
function bodyWithoutTokens(
  form: ReturnFormState,
  reasonKey: SalesReturnReason,
): SalesReturnRequestBody {
  return buildReturnBody({
    drafts: form.drafts,
    returnDeliveryCharge: form.returnDeliveryCharge,
    refundMethod: form.refundMethod,
    refundExternalReference: form.refundReference,
    reasonKey,
    note: form.note,
  });
}

export interface ReturnSubmitState {
  readonly isSubmitting: boolean;
  readonly failure: RuleFailure | undefined;
  readonly approvals: ReturnApprovalFlow;
  readonly submit: () => Promise<void>;
}

/** Collects the PINs the preview asked for, then creates the return with one key per submit. */
export function useReturnSubmit(input: {
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly form: ReturnFormState;
  readonly preview: SalesReturnPreviewResponse | undefined;
  readonly approvalLabels: OrderApprovalLabels;
  readonly onCreated: (created: SalesReturnResponse) => void;
}): ReturnSubmitState {
  const { t } = useTranslator();
  const approvals = useReturnApprovalFlow(input.organizationId, input.approvalLabels);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<RuleFailure | undefined>(undefined);
  const keyRef = useRef<{ readonly bodyKey: string; readonly key: string } | undefined>(undefined);

  function keyFor(body: string): string {
    if (keyRef.current?.bodyKey === body) return keyRef.current.key;
    const key = newSubmitKey();
    keyRef.current = { bodyKey: body, key };
    return key;
  }

  async function submit(): Promise<void> {
    const { form, preview, order } = input;
    if (preview === undefined || form.reasonKey === undefined) return;
    setIsSubmitting(true);
    setFailure(undefined);
    try {
      const granted = await approvals.collect(returnApprovalStepsOf(preview, order));
      const body = {
        ...bodyWithoutTokens(form, form.reasonKey),
        approvalTokens: approvalTokensOf(granted),
      };
      const created = await createReturn({
        organizationId: input.organizationId,
        orderId: order.orderId,
        body,
        idempotencyKey: keyFor(JSON.stringify(bodyWithoutTokens(form, form.reasonKey))),
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

/** Whether a line may still be returned at all; a fully returned line stays visible but disabled. */
export function isLineReturnable(draft: ReturnLineDraft): boolean {
  return draft.remainingQuantity > 0;
}
