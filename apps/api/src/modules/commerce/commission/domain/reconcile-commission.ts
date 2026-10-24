import type { Money } from "@banijjik/contracts/accounting";
import { floorRatio } from "./resolve-commission-rule.js";

/**
 * The change of one order-line ledger when units come back (plan 3.5b decision 10): the net must
 * equal `accrual − floor(accrual × returnedQuantity / soldQuantity)`. A refund without a return
 * never reaches this function, because a refund is a price concession, not a return of work.
 */
export function returnAdjustmentDelta(input: {
  readonly accrual: Money;
  readonly soldQuantity: number;
  readonly returnedQuantity: number;
  readonly currentNet: Money;
}): number {
  const sold = input.soldQuantity;
  const returned = Math.min(Math.max(input.returnedQuantity, 0), sold);
  const reduction = sold === 0 ? 0 : floorRatio(input.accrual.amount, returned, sold);
  const targetNet = input.accrual.amount - reduction;
  return targetNet - input.currentNet.amount;
}

/**
 * How much the ledger of one source and member must change so that its net equals
 * `accrual − floor(accrual × refunded / gross)`. The target comes from the cumulative refund every
 * time, never from adding per-refund roundings, so a full refund leaves exactly 0, a refund
 * reversal restores the accrual, and a replay finds 0 (ADR-135). Minor units; 0 = write nothing.
 */
export function refundAdjustmentDelta(input: {
  readonly accrual: Money;
  readonly sourceGrossTotal: Money;
  readonly refunded: Money;
  readonly currentNet: Money;
}): number {
  const gross = input.sourceGrossTotal.amount;
  const refunded = Math.min(Math.max(input.refunded.amount, 0), gross);
  const reduction = gross === 0 ? 0 : floorRatio(input.accrual.amount, refunded, gross);
  const targetNet = input.accrual.amount - reduction;
  return targetNet - input.currentNet.amount;
}
