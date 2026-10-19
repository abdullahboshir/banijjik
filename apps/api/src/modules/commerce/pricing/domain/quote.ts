import type {
  ApprovalRequired,
  QuoteLineResult,
  QuoteResponse,
  QuoteTotals,
} from "@banijjik/contracts/pricing";
import { allocateByLargestRemainder, cashRound, lineGrossOf, taxOf } from "./money-math.js";
import { approvalsFor, manualAmount, orderApprovals } from "./quote-approvals.js";
import { applyPromotions } from "./quote-promotions.js";
import {
  moneyOf,
  type QuoteLineSource,
  type QuotePipelineInput,
  type QuotePromotion,
} from "./quote-types.js";

export type { QuoteLineSource, QuotePipelineInput, QuotePromotion };

interface DraftedLine {
  readonly line: QuoteLineSource;
  readonly lineGross: number;
  readonly promotionDiscount: number;
  readonly promotionIds: readonly string[];
  readonly manualDiscount: number;
  readonly afterManual: number;
}

function draftLines(
  input: QuotePipelineInput,
  thresholds: { readonly percentAbove: number; readonly amountAbove: number },
  approvalsRequired: ApprovalRequired[],
): DraftedLine[] {
  return input.lines.map((line, lineIndex) => {
    const lineGross = lineGrossOf({
      unitPriceMinor: line.unitPriceMinor,
      quantity: line.quantity,
      precision: line.precision,
    });
    const promotions = applyPromotions({
      line,
      lineGross,
      promotions: input.promotions,
      locationId: input.locationId,
      at: input.at,
    });
    const afterPromotion = Math.max(0, lineGross - promotions.discount);
    const manual = manualAmount(line.manualDiscount, afterPromotion);
    approvalsRequired.push(
      ...approvalsFor({
        lineIndex,
        discount: line.manualDiscount,
        lineGross,
        thresholds,
      }),
    );
    return {
      line,
      lineGross,
      promotionDiscount: promotions.discount,
      promotionIds: promotions.promotionIds,
      manualDiscount: manual,
      afterManual: Math.max(0, afterPromotion - manual),
    };
  });
}

function buildLineResults(
  drafted: readonly DraftedLine[],
  orderShares: readonly number[],
  input: QuotePipelineInput,
): QuoteLineResult[] {
  const { currency } = input;
  return drafted.map((row, index) => {
    const orderPart = orderShares[index] ?? 0;
    const lineDiscount = row.promotionDiscount + row.manualDiscount + orderPart;
    const taxable = Math.max(0, row.lineGross - lineDiscount);
    const lineTax = taxOf({
      netMinor: taxable,
      rateBasisPoints: row.line.taxRateBasisPoints,
      taxInclusive: input.taxInclusive,
    });
    const lineNetTotal = input.taxInclusive ? taxable : taxable + lineTax;
    return {
      offeringId: row.line.offeringId,
      variantId: row.line.variantId,
      quantity: row.line.quantity,
      unitPrice: moneyOf(row.line.unitPriceMinor, currency),
      lineGross: moneyOf(row.lineGross, currency),
      promotionDiscount: moneyOf(row.promotionDiscount, currency),
      manualDiscount: moneyOf(row.manualDiscount, currency),
      lineDiscount: moneyOf(lineDiscount, currency),
      lineTax: moneyOf(lineTax, currency),
      lineNetTotal: moneyOf(lineNetTotal, currency),
      promotionIds: row.promotionIds,
      taxClassKey: row.line.taxClassKey ?? null,
      taxRateBasisPoints: row.line.taxRateBasisPoints,
    };
  });
}

function totalsOf(lines: readonly QuoteLineResult[], input: QuotePipelineInput): QuoteTotals {
  const { currency } = input;
  const subtotal = lines.reduce((sum, line) => sum + line.lineGross.amount, 0);
  const discountTotal = lines.reduce((sum, line) => sum + line.lineDiscount.amount, 0);
  const taxTotal = lines.reduce((sum, line) => sum + line.lineTax.amount, 0);
  const beforeRounding = lines.reduce((sum, line) => sum + line.lineNetTotal.amount, 0);
  const rounded =
    input.paymentIsCash && input.rounding !== "NONE"
      ? cashRound(beforeRounding, input.rounding)
      : { roundedTotal: beforeRounding, roundingAdjustment: 0 };
  return {
    subtotal: moneyOf(subtotal, currency),
    discountTotal: moneyOf(discountTotal, currency),
    taxTotal: moneyOf(taxTotal, currency),
    grandTotal: moneyOf(rounded.roundedTotal, currency),
    roundingAdjustment: moneyOf(rounded.roundingAdjustment, currency),
  };
}

/**
 * Pure quote pipeline of 11 §3 / ADR-120. Callers load catalog rows, tax classes and promotions
 * and pass them here; this function never reads the database.
 */
export function computeQuote(input: QuotePipelineInput): QuoteResponse {
  const thresholds = {
    percentAbove: input.approvalPercentAbove,
    amountAbove: input.approvalAmountAbove,
  };
  const approvalsRequired: ApprovalRequired[] = [];
  const drafted = draftLines(input, thresholds, approvalsRequired);

  const afterManualTotal = drafted.reduce((sum, row) => sum + row.afterManual, 0);
  const orderGrossBase = drafted.reduce((sum, row) => sum + row.lineGross, 0);
  const orderPool = Math.min(manualAmount(input.orderDiscount, afterManualTotal), afterManualTotal);
  approvalsRequired.push(
    ...orderApprovals({
      discount: input.orderDiscount,
      subtotal: orderGrossBase,
      thresholds,
    }),
  );
  // Order discount is allocated by line gross (11 §3), capped so a line never goes below zero;
  // anything capped off is re-allocated to lines that still have room (R1-1).
  const orderShares = allocateOrderDiscount(orderPool, drafted);

  const lines = buildLineResults(drafted, orderShares, input);
  return { lines, totals: totalsOf(lines, input), approvalsRequired };
}

/**
 * Spread `orderPool` across lines by line gross (largest remainder). When a share exceeds what a
 * line can still take after promotions and manual discount, the leftover is given to lines that
 * still have room — same weights, repeat until the pool is spent or no room remains.
 */
function allocateOrderDiscount(orderPool: number, drafted: readonly DraftedLine[]): number[] {
  const allocated = drafted.map(() => 0);
  let remaining = orderPool;
  while (remaining > 0) {
    const rooms = drafted.map((row, index) =>
      Math.max(0, row.afterManual - (allocated[index] ?? 0)),
    );
    if (rooms.every((room) => room === 0)) break;
    const weights = drafted.map((row, index) => ((rooms[index] ?? 0) > 0 ? row.lineGross : 0));
    const shares = allocateByLargestRemainder(remaining, weights);
    let given = 0;
    for (let index = 0; index < drafted.length; index += 1) {
      const add = Math.min(shares[index] ?? 0, rooms[index] ?? 0);
      allocated[index] = (allocated[index] ?? 0) + add;
      given += add;
    }
    if (given === 0) break;
    remaining -= given;
  }
  return allocated;
}
