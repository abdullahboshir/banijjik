import { APPROVAL_ACTION, type ApprovalAction } from "@banijjik/contracts/iam";
import {
  ORDER_RETURN_STATUS,
  ORDER_STATUS,
  orderApprovalSubject,
  RETURN_DISPOSITION,
  SALES_RETURN_REASON,
  SALES_RETURN_REFUND_METHOD,
  type OrderLineSnapshot,
  type OrderResponse,
  type ReturnDisposition,
  type SalesReturnPreviewResponse,
} from "@banijjik/contracts/sales";
import type { SalesReturnRequestBody } from "@banijjik/validation/sales";
import { PAYMENT_METHOD, type PaymentMethod } from "@banijjik/contracts/payment";
import type { Money } from "@banijjik/contracts/pricing";

/** The approval token keys of `approvalTokens` in the return request (plan Amendment 1 item 3). */
export const RETURN_APPROVAL_KEY = {
  REFUND: "refund",
  RETURN_NOT_RECEIVED: "returnNotReceived",
} as const;
export type ReturnApprovalKey = (typeof RETURN_APPROVAL_KEY)[keyof typeof RETURN_APPROVAL_KEY];

/** One PIN the staff member must hand over before the request can go out; `key` names the token it fills. */
export interface ApprovalStep {
  readonly key: string;
  readonly action: ApprovalAction;
  readonly subjectKey: string;
  readonly locationId: string;
  readonly amount: Money;
}

/** One line of the return sheet: what was sold, what is left and what the staff member picked. */
export interface ReturnLineDraft {
  readonly orderLineId: string;
  readonly nameSnapshot: string;
  readonly soldQuantity: number;
  readonly remainingQuantity: number;
  readonly quantity: number;
  readonly disposition: ReturnDisposition;
}

const DAY_IN_MILLISECONDS = 86_400_000;
const REFUND_METHOD_VALUES: readonly string[] = Object.values(SALES_RETURN_REFUND_METHOD);
const NO_QUANTITY = 0;

/** Every line starts at zero, so the sheet only sends what the staff member actually picked. */
export function returnDraftsOf(order: OrderResponse): readonly ReturnLineDraft[] {
  return order.lines.map((line) => draftOf(line));
}

function draftOf(line: OrderLineSnapshot): ReturnLineDraft {
  return {
    orderLineId: line.orderLineId,
    nameSnapshot: line.nameSnapshot,
    soldQuantity: line.quantity,
    remainingQuantity: Math.max(NO_QUANTITY, line.quantity - line.returnedQuantity),
    quantity: NO_QUANTITY,
    disposition: RETURN_DISPOSITION.RESTOCK,
  };
}

/** The stepper never goes below zero nor above what is left on the line (plan B: capped at what is left). */
export function clampReturnQuantity(draft: ReturnLineDraft, requested: number): number {
  if (!Number.isInteger(requested)) return draft.quantity;
  return Math.min(Math.max(NO_QUANTITY, requested), draft.remainingQuantity);
}

export function withReturnQuantity(
  drafts: readonly ReturnLineDraft[],
  orderLineId: string,
  requested: number,
): readonly ReturnLineDraft[] {
  return drafts.map((draft) =>
    draft.orderLineId === orderLineId
      ? { ...draft, quantity: clampReturnQuantity(draft, requested) }
      : draft,
  );
}

export function withReturnDisposition(
  drafts: readonly ReturnLineDraft[],
  orderLineId: string,
  disposition: ReturnDisposition,
): readonly ReturnLineDraft[] {
  return drafts.map((draft) =>
    draft.orderLineId === orderLineId ? { ...draft, disposition } : draft,
  );
}

/** The lines that actually return something; a return needs at least one. */
export function pickedReturnLines(drafts: readonly ReturnLineDraft[]): readonly ReturnLineDraft[] {
  return drafts.filter((draft) => draft.quantity > NO_QUANTITY);
}

/** Refund methods the sheet offers: STORE_CREDIT only with a contact, GATEWAY never (plan decision 5). */
export function refundMethodsFor(
  allowedMethods: readonly PaymentMethod[],
  hasContact: boolean,
): readonly PaymentMethod[] {
  return allowedMethods.filter((method) => {
    if (method === SALES_RETURN_REFUND_METHOD.STORE_CREDIT) return hasContact;
    return REFUND_METHOD_VALUES.includes(method);
  });
}

/** Mobile money refunds need the transaction reference the payment module asks for (BKASH, NAGAD). */
export function needsRefundReference(method: PaymentMethod | null): boolean {
  return method === PAYMENT_METHOD.BKASH || method === PAYMENT_METHOD.NAGAD;
}

export interface ReturnBodyInput {
  readonly drafts: readonly ReturnLineDraft[];
  readonly returnDeliveryCharge: boolean;
  readonly refundMethod: PaymentMethod | null;
  readonly refundExternalReference: string;
  readonly reasonKey: SalesReturnRequestBody["reasonKey"];
  readonly note: string;
  readonly approvalTokens?: SalesReturnRequestBody["approvalTokens"];
}

/** The request body of the preview and the create: the same shape, the server computes every amount. */
export function buildReturnBody(input: ReturnBodyInput): SalesReturnRequestBody {
  const reference = input.refundExternalReference.trim();
  const note = input.note.trim();
  return {
    lines: pickedReturnLines(input.drafts).map((draft) => ({
      orderLineId: draft.orderLineId,
      quantity: draft.quantity,
      disposition: draft.disposition,
    })),
    returnDeliveryCharge: input.returnDeliveryCharge,
    ...(input.refundMethod === null ? {} : { refundMethod: input.refundMethod }),
    ...(reference === "" ? {} : { refundExternalReference: reference }),
    reasonKey: input.reasonKey,
    ...(note === "" ? {} : { note }),
    ...(input.approvalTokens === undefined ? {} : { approvalTokens: input.approvalTokens }),
  };
}

/** Sum of the lines the staff member marked NOT_RECEIVED: the approval amount for that action (plan 3.5b decision 6). */
export function notReceivedValueOf(preview: SalesReturnPreviewResponse): Money {
  const amount = preview.lines
    .filter((line) => line.disposition === RETURN_DISPOSITION.NOT_RECEIVED)
    .reduce((total, line) => total + line.value.amount, NO_QUANTITY);
  return { amount, currency: preview.value.currency };
}

/**
 * The PINs a return needs, from the server preview, in the order the screen asks for them:
 * the refund first, then the not-received lines (plan 3.5b decision 6, Amendment 1).
 */
export function returnApprovalStepsOf(
  preview: SalesReturnPreviewResponse,
  order: Pick<OrderResponse, "orderId" | "locationId">,
): readonly ApprovalStep[] {
  const steps: ApprovalStep[] = [];
  const subjectKey = orderApprovalSubject(order.orderId);
  if (preview.requiresRefundApproval) {
    steps.push({
      key: RETURN_APPROVAL_KEY.REFUND,
      action: APPROVAL_ACTION.REFUND,
      subjectKey,
      locationId: order.locationId,
      amount: preview.refundAmount,
    });
  }
  if (preview.requiresNotReceivedApproval) {
    steps.push({
      key: RETURN_APPROVAL_KEY.RETURN_NOT_RECEIVED,
      action: APPROVAL_ACTION.RETURN_NOT_RECEIVED,
      subjectKey,
      locationId: order.locationId,
      amount: notReceivedValueOf(preview),
    });
  }
  return steps;
}

/** The return and reverse screens keep their window check here, so both read the same rule. */
function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setTime(date.getTime() + days * DAY_IN_MILLISECONDS);
  return date.toISOString().slice(0, 10);
}

/**
 * The window is hinted from the business date (the server's `completedAt` rule is the judge). A
 * return on the last day of the window is still allowed; the day after it is not.
 */
export function isWithinReturnWindow(
  businessDate: string,
  windowDays: number,
  today: string,
): boolean {
  return today <= addDaysToIsoDate(businessDate, windowDays);
}

/** Today's calendar date in the organization's time zone, as YYYY-MM-DD. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whether the order detail offers "Return": a completed order that still has goods to return, inside the window. */
export function canOfferReturn(order: OrderResponse, windowOpen: boolean): boolean {
  return (
    windowOpen &&
    order.status === ORDER_STATUS.COMPLETED &&
    order.returnStatus !== ORDER_RETURN_STATUS.FULL
  );
}

/** Reason OTHER needs a note; the server refuses it without one, the sheet says so first. */
export function reasonNeedsNote(reasonKey: string, note: string): boolean {
  return reasonKey === SALES_RETURN_REASON.OTHER && note.trim() === "";
}

/**
 * The preview needs a reason and a refund method to be valid, but neither changes an amount. The
 * sheet previews with these placeholders until the staff member chooses, so the amounts show early.
 */
export const PREVIEW_PLACEHOLDER_REASON = SALES_RETURN_REASON.CHANGED_MIND;
export const PREVIEW_PLACEHOLDER_METHOD = PAYMENT_METHOD.CASH;

/** The tokens the server reads from `approvalTokens`; keys that were not needed stay out. */
export function approvalTokensOf(granted: Readonly<Record<string, string>>): {
  readonly refund?: string;
  readonly returnNotReceived?: string;
} {
  const refund = granted[RETURN_APPROVAL_KEY.REFUND];
  const returnNotReceived = granted[RETURN_APPROVAL_KEY.RETURN_NOT_RECEIVED];
  return {
    ...(refund === undefined ? {} : { refund }),
    ...(returnNotReceived === undefined ? {} : { returnNotReceived }),
  };
}
