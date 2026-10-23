import type { Money } from "@banijjik/contracts/accounting";
import { floorRatio } from "./resolve-commission-rule.js";

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
