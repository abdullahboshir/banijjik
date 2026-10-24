import type { Money, ReturnDisposition, SalesReturnReason } from "@banijjik/contracts/sales";
import { SALES_RETURN_REASON } from "@banijjik/contracts/sales";
import { recordNotFound } from "./errors.js";
import {
  deliveryChargeReturnedMinor as deliveryChargeOwedBackMinor,
  returnLineShare,
  roundingReturnedMinor as roundingOwedBackMinor,
} from "./sales-return-amounts.js";
import type { OrderLineProps, OrderProps } from "./order-types.js";
import {
  duplicateReturnLine,
  otherReasonNeedsNote,
  quantityAboveSold,
} from "./sales-return-errors.js";

export interface ReturnRequestLine {
  readonly orderLineId: string;
  readonly quantity: number;
  readonly disposition: ReturnDisposition;
}

export interface SalesReturnPlanInput {
  readonly lines: readonly OrderLineProps[];
  readonly totals: OrderProps["totals"];
  readonly requestLines: readonly ReturnRequestLine[];
  readonly returnDeliveryCharge: boolean;
  readonly reasonKey: SalesReturnReason;
  readonly note: string | null;
  /** Delivery charge already given back by earlier ACTIVE returns of the order. */
  readonly deliveryReturnedBefore: Money;
}

export interface PlannedReturnLine {
  readonly orderLineId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly nameSnapshot: string;
  readonly quantity: number;
  readonly disposition: ReturnDisposition;
  readonly value: Money;
  readonly taxPart: Money;
  /** Only lines that draw stock move stock on a return (a service line has no components). */
  readonly drawsStock: boolean;
}

export interface SalesReturnPlan {
  readonly lines: readonly PlannedReturnLine[];
  /** The order lines with `returnedQuantity` moved; the order is written with them. */
  readonly updatedLines: readonly OrderLineProps[];
  readonly deliveryChargeReturned: Money;
  readonly roundingReturned: Money;
  /** Σ line values + delivery + rounding (plan decision 1). */
  readonly value: Money;
  readonly notReceivedValue: Money;
}

function findLine(lines: readonly OrderLineProps[], orderLineId: string): OrderLineProps {
  const line = lines.find((candidate) => candidate.orderLineId === orderLineId);
  if (line === undefined) throw recordNotFound();
  return line;
}

function assertUniqueLines(requestLines: readonly ReturnRequestLine[]): void {
  const seen = new Set<string>();
  for (const requestLine of requestLines) {
    if (seen.has(requestLine.orderLineId)) throw duplicateReturnLine(requestLine.orderLineId);
    seen.add(requestLine.orderLineId);
  }
}

function assertNoteForOtherReason(reasonKey: SalesReturnReason, note: string | null): void {
  if (reasonKey !== SALES_RETURN_REASON.OTHER) return;
  if (note === null || note.trim().length === 0) throw otherReasonNeedsNote();
}

/** The line's quantity can never exceed what is still on it (plan decision 3). */
function assertWithinSold(line: OrderLineProps, quantity: number): void {
  if (line.returnedQuantity + quantity > line.quantity) throw quantityAboveSold(line.orderLineId);
}

function planLine(line: OrderLineProps, requestLine: ReturnRequestLine): PlannedReturnLine {
  assertWithinSold(line, requestLine.quantity);
  const share = returnLineShare({
    soldQuantity: line.quantity,
    returnedBefore: line.returnedQuantity,
    quantity: requestLine.quantity,
    lineNetTotalMinor: line.lineNetTotal.amount,
    lineTaxMinor: line.lineTax.amount,
  });
  return {
    orderLineId: line.orderLineId,
    offeringId: line.offeringId,
    variantId: line.variantId,
    nameSnapshot: line.nameSnapshot,
    quantity: requestLine.quantity,
    disposition: requestLine.disposition,
    value: { amount: share.valueMinor, currency: line.lineNetTotal.currency },
    taxPart: { amount: share.taxPartMinor, currency: line.lineTax.currency },
    drawsStock: line.costComponents.length > 0,
  };
}

function sumMinor(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/** After this return every line of the order is fully returned (rounding goes back only then). */
function everyLineFullyReturnedAfter(
  lines: readonly OrderLineProps[],
  requestLines: readonly ReturnRequestLine[],
): boolean {
  const requested = new Map(requestLines.map((line) => [line.orderLineId, line.quantity]));
  return lines.every(
    (line) => line.returnedQuantity + (requested.get(line.orderLineId) ?? 0) >= line.quantity,
  );
}

/**
 * Turns a return request into amounts and the moved order lines (plan 3.5b decisions 3, 4, 7). Pure:
 * it reads nothing and writes nothing, so the preview and the create use the same numbers.
 */
export function planSalesReturn(input: SalesReturnPlanInput): SalesReturnPlan {
  assertUniqueLines(input.requestLines);
  assertNoteForOtherReason(input.reasonKey, input.note);
  const plannedLines = input.requestLines.map((requestLine) =>
    planLine(findLine(input.lines, requestLine.orderLineId), requestLine),
  );
  const currency = input.totals.grandTotal.currency;
  const deliveryMinor = deliveryChargeOwedBackMinor({
    returnDeliveryCharge: input.returnDeliveryCharge,
    orderDeliveryChargeMinor: input.totals.deliveryCharge.amount,
    deliveryReturnedBeforeMinor: input.deliveryReturnedBefore.amount,
  });
  const roundingMinor = roundingOwedBackMinor({
    everyLineFullyReturned: everyLineFullyReturnedAfter(input.lines, input.requestLines),
    roundingAdjustmentMinor: input.totals.roundingAdjustment.amount,
  });
  const linesMinor = sumMinor(plannedLines.map((line) => line.value.amount));
  const notReceivedMinor = sumMinor(
    plannedLines
      .filter((line) => line.disposition === "NOT_RECEIVED")
      .map((line) => line.value.amount),
  );
  return {
    lines: plannedLines,
    updatedLines: input.lines.map((line) => {
      const requestLine = input.requestLines.find((item) => item.orderLineId === line.orderLineId);
      if (requestLine === undefined) return line;
      return { ...line, returnedQuantity: line.returnedQuantity + requestLine.quantity };
    }),
    deliveryChargeReturned: { amount: deliveryMinor, currency },
    roundingReturned: { amount: roundingMinor, currency },
    value: { amount: linesMinor + deliveryMinor + roundingMinor, currency },
    notReceivedValue: { amount: notReceivedMinor, currency },
  };
}
