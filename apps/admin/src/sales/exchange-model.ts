import type { CurrencyCode } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import type { PaymentMethod } from "@banijjik/contracts/payment";
import type { ManualDiscount, Money, QuoteResponse } from "@banijjik/contracts/pricing";
import {
  INSTANT_ORDER_APPROVAL_SUBJECT,
  MAX_EXCHANGE_PAYMENTS,
  SALES_EXCHANGE_PAYMENT_METHODS,
  type OrderResponse,
  type SalesExchangePaymentMethod,
  type SalesExchangePreviewResponse,
  type SalesReturnReason,
} from "@banijjik/contracts/sales";
import { parseMoneyInput } from "@banijjik/ui";
import type {
  OrderLineInputBody,
  SalesExchangePaymentBody,
  SalesExchangeRequestBody,
} from "@banijjik/validation/sales";
import { manualDiscountTotalOf } from "./order-lines";
import {
  approvalTokensOf,
  buildReturnBody,
  canOfferReturn,
  needsRefundReference,
  pickedReturnLines,
  returnApprovalStepsOf,
  type ApprovalStep,
  type ReturnLineDraft,
} from "./return-model";
import type { GrantedApprovals } from "./return-approval-flow";

/** The grant key of the new order's discount PIN; the exchange body sends it as `order.approvalToken`. */
export const EXCHANGE_DISCOUNT_APPROVAL_KEY = "exchangeOrderDiscount";

const EXCHANGE_PAYMENT_METHOD_VALUES: readonly string[] = Object.values(
  SALES_EXCHANGE_PAYMENT_METHODS,
);
const ZERO = 0;
const FRACTION_DIGITS = 2;
const MINOR_UNITS_PER_MAJOR = 100;

/** One payment line on the summary step: the method, the typed amount and the reference (bKash, Nagad). */
export interface ExchangePaymentDraft {
  readonly draftId: string;
  readonly method: SalesExchangePaymentMethod;
  readonly amountText: string;
  readonly reference: string;
}

/** Why the exchange cannot be sent yet; the sheet names the blocker next to the button. */
export type ExchangeBlocker =
  | "NO_RETURN_LINES"
  | "REASON"
  | "NOTE"
  | "NO_NEW_LINES"
  | "INVALID_NEW_LINES"
  | "PAYMENT_AMOUNT"
  | "PAYMENT_REFERENCE"
  | "NO_PREVIEW";

function isExchangePaymentMethod(method: PaymentMethod): method is SalesExchangePaymentMethod {
  return EXCHANGE_PAYMENT_METHOD_VALUES.includes(method);
}

/** The shop's own payment methods that an exchange payment may use (plan 3.5b E2). */
export function exchangeMethodsFor(
  allowedMethods: readonly PaymentMethod[],
): readonly SalesExchangePaymentMethod[] {
  return allowedMethods.filter(isExchangePaymentMethod);
}

/** An exchange is offered for a completed order that has a customer, inside the return window. */
export function canOfferExchange(order: OrderResponse, windowOpen: boolean): boolean {
  return order.contactId !== null && canOfferReturn(order, windowOpen);
}

/** Minor units of a typed amount; undefined when the text is not a valid positive amount. */
export function paymentMinorOf(draft: ExchangePaymentDraft): number | undefined {
  const parsed = parseMoneyInput(draft.amountText, FRACTION_DIGITS);
  if (parsed === undefined || parsed.minorUnits <= ZERO) return undefined;
  return parsed.minorUnits;
}

/** The text an input shows for a minor amount, so a clamped amount reads back as typed. */
export function minorToInputText(minor: number): string {
  const whole = Math.floor(minor / MINOR_UNITS_PER_MAJOR);
  const fraction = minor % MINOR_UNITS_PER_MAJOR;
  return fraction === ZERO ? String(whole) : `${whole}.${String(fraction).padStart(2, "0")}`;
}

/**
 * What is still to pay on the new order: its total minus the store credit that pays it, minus the
 * other payment lines. A payment line can never be typed above this (plan 3.5b B2).
 */
export function leftToPayMinor(
  preview: SalesExchangePreviewResponse,
  payments: readonly ExchangePaymentDraft[],
  draftId: string,
): number {
  const otherPayments = payments
    .filter((payment) => payment.draftId !== draftId)
    .reduce((total, payment) => total + (paymentMinorOf(payment) ?? ZERO), ZERO);
  const left = preview.orderGrandTotal.amount - preview.storeCreditUsed.amount - otherPayments;
  return Math.max(ZERO, left);
}

/** Clamps a typed amount into 0..cap: a payment line never holds more than is left to pay. */
export function clampPaymentMinor(requested: number, capMinor: number): number {
  return Math.min(Math.max(ZERO, requested), capMinor);
}

/** The amount text a payment line keeps after a typed change: what was typed, or the cap when it is above it. */
export function clampedAmountText(typed: string, capMinor: number): string {
  const parsed = parseMoneyInput(typed, FRACTION_DIGITS);
  if (parsed === undefined || parsed.minorUnits <= capMinor) return typed;
  return minorToInputText(capMinor);
}

/** Only the valid payment lines go out; the store credit is never a line (the server spends it). */
export function exchangePaymentBodiesOf(
  payments: readonly ExchangePaymentDraft[],
  currency: CurrencyCode,
): SalesExchangePaymentBody[] {
  const bodies: SalesExchangePaymentBody[] = [];
  for (const payment of payments) {
    const minor = paymentMinorOf(payment);
    if (minor === undefined) continue;
    bodies.push(paymentBodyOf(payment, minor, currency));
  }
  return bodies;
}

function paymentBodyOf(
  payment: ExchangePaymentDraft,
  minor: number,
  currency: CurrencyCode,
): SalesExchangePaymentBody {
  const reference = payment.reference.trim();
  const withReference = needsRefundReference(payment.method) && reference !== "";
  return {
    method: payment.method,
    amount: { amount: minor, currency },
    ...(withReference ? { externalReference: reference } : {}),
  };
}

export interface ExchangeBodyInput {
  readonly returnDrafts: readonly ReturnLineDraft[];
  readonly returnDeliveryCharge: boolean;
  readonly reasonKey: SalesReturnReason;
  readonly returnNote: string;
  readonly lineInputs: readonly OrderLineInputBody[];
  readonly orderDiscount: ManualDiscount | undefined;
  readonly orderNote: string;
  readonly payments: readonly ExchangePaymentDraft[];
  readonly currency: CurrencyCode;
  /** The granted PINs keyed like the approval steps; absent on a preview, which needs none. */
  readonly granted?: GrantedApprovals;
}

/** The request body of the preview and the create: the same shape, the server computes every amount. */
export function buildExchangeBody(input: ExchangeBodyInput): SalesExchangeRequestBody {
  return {
    return: buildReturnBody({
      drafts: input.returnDrafts,
      returnDeliveryCharge: input.returnDeliveryCharge,
      refundMethod: null,
      refundExternalReference: "",
      reasonKey: input.reasonKey,
      note: input.returnNote,
      ...(input.granted === undefined ? {} : { approvalTokens: approvalTokensOf(input.granted) }),
    }),
    order: orderPartOf(input),
    payments: exchangePaymentBodiesOf(input.payments, input.currency),
  };
}

/** The new order part: its lines, discount and note, plus the discount PIN token once granted. */
function orderPartOf(input: ExchangeBodyInput): SalesExchangeRequestBody["order"] {
  const note = input.orderNote.trim();
  const discountToken = input.granted?.[EXCHANGE_DISCOUNT_APPROVAL_KEY];
  return {
    lines: [...input.lineInputs],
    ...(input.orderDiscount === undefined ? {} : { orderDiscount: input.orderDiscount }),
    ...(note === "" ? {} : { note }),
    ...(discountToken === undefined ? {} : { approvalToken: discountToken }),
  };
}

/** The discount PIN the new order needs, from a fresh quote of its lines; undefined when none is asked. */
export function discountApprovalOf(
  quote: QuoteResponse,
  currency: CurrencyCode,
): Money | undefined {
  const asksForDiscount = quote.approvalsRequired.some(
    (required) => required.action === APPROVAL_ACTION.DISCOUNT,
  );
  if (!asksForDiscount) return undefined;
  return { amount: manualDiscountTotalOf(quote), currency };
}

/** The PINs an exchange needs, in the order the screen asks: the return's, then the new order's discount. */
export function exchangeApprovalStepsOf(
  preview: SalesExchangePreviewResponse,
  order: Pick<OrderResponse, "orderId" | "locationId">,
  discount: Money | undefined,
): readonly ApprovalStep[] {
  const returnSteps = returnApprovalStepsOf(preview.salesReturn, order);
  if (discount === undefined) return returnSteps;
  const discountStep: ApprovalStep = {
    key: EXCHANGE_DISCOUNT_APPROVAL_KEY,
    action: APPROVAL_ACTION.DISCOUNT,
    subjectKey: INSTANT_ORDER_APPROVAL_SUBJECT,
    locationId: order.locationId,
    amount: discount,
  };
  return [...returnSteps, discountStep];
}

/** The return part of the blockers: a line, a reason and, for Other, a note. */
export function returnBlockerOf(input: ExchangeBlockerInput): ExchangeBlocker | undefined {
  if (pickedReturnLines(input.returnDrafts).length === ZERO) return "NO_RETURN_LINES";
  if (input.reasonKey === undefined) return "REASON";
  if (input.reasonKey === "OTHER" && input.returnNote.trim() === "") return "NOTE";
  return undefined;
}

/** The new order part of the blockers: at least one valid line. */
export function newLinesBlockerOf(input: ExchangeBlockerInput): ExchangeBlocker | undefined {
  if (input.lineCount === ZERO) return "NO_NEW_LINES";
  if (input.invalidLineCount > ZERO) return "INVALID_NEW_LINES";
  return undefined;
}

/** The payment part of the blockers: every typed amount valid, every bKash or Nagad reference given. */
function paymentBlockerOf(payments: readonly ExchangePaymentDraft[]): ExchangeBlocker | undefined {
  if (payments.some((payment) => paymentMinorOf(payment) === undefined)) return "PAYMENT_AMOUNT";
  if (payments.some(isReferenceMissing)) return "PAYMENT_REFERENCE";
  return undefined;
}

function isReferenceMissing(payment: ExchangePaymentDraft): boolean {
  return needsRefundReference(payment.method) && payment.reference.trim() === "";
}

export interface ExchangeBlockerInput {
  readonly returnDrafts: readonly ReturnLineDraft[];
  readonly reasonKey: SalesReturnReason | undefined;
  readonly returnNote: string;
  readonly lineCount: number;
  readonly invalidLineCount: number;
  readonly payments: readonly ExchangePaymentDraft[];
  readonly hasPreview: boolean;
}

/** The first thing that stops the submit, in the order the steps ask; undefined when it can be sent. */
export function exchangeBlockerOf(input: ExchangeBlockerInput): ExchangeBlocker | undefined {
  return (
    returnBlockerOf(input) ??
    newLinesBlockerOf(input) ??
    paymentBlockerOf(input.payments) ??
    (input.hasPreview ? undefined : "NO_PREVIEW")
  );
}

/** A payment line may be added while the exchange has fewer than the plan's maximum (plan E2). */
export function canAddPayment(payments: readonly ExchangePaymentDraft[]): boolean {
  return payments.length < MAX_EXCHANGE_PAYMENTS;
}
