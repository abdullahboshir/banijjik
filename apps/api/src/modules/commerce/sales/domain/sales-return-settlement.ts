/**
 * How a return settles against what the customer paid (plan 3.5b decision 5, manoxen guide 15).
 * The due drops first. Cash goes back only for the part that was paid above the new total, so the
 * refund can never exceed the net paid.
 */

export interface ReturnSettlementInput {
  /** The order total before the return (the payment summary's total). */
  readonly totalMinor: number;
  /** Allocated minus refunded: what the customer has actually paid and kept. */
  readonly netPaidMinor: number;
  /** The value of the goods returned now. */
  readonly valueMinor: number;
}

export interface ReturnSettlement {
  /** The order total after the return, never below zero. */
  readonly newTotalMinor: number;
  /** How much of the due the return removed. */
  readonly dueReducedMinor: number;
  /** Cash or store credit owed back to the customer. Zero when the due absorbed the value. */
  readonly refundMinor: number;
}

export function settleReturn(input: ReturnSettlementInput): ReturnSettlement {
  const { totalMinor, netPaidMinor, valueMinor } = input;
  const newTotalMinor = Math.max(0, totalMinor - valueMinor);
  const outstandingBeforeMinor = Math.max(0, totalMinor - netPaidMinor);
  const dueReducedMinor = Math.min(valueMinor, outstandingBeforeMinor);
  const refundMinor = Math.max(0, netPaidMinor - newTotalMinor);
  return { newTotalMinor, dueReducedMinor, refundMinor };
}
