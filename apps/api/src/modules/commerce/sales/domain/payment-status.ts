import { PAYMENT_STATUS, type Money, type PaymentStatus } from "@banijjik/contracts/sales";

export interface PaymentTotals {
  readonly paidMinor: number;
  readonly refundedMinor: number;
}

/**
 * `11 §4.3`: the status is derived from the allocations and refunds, never set by hand.
 * A zero total is settled (nothing is owed); refunds win over the paid amount.
 */
export function derivePaymentStatus(grandTotal: Money, totals: PaymentTotals): PaymentStatus {
  if (grandTotal.amount <= 0) return PAYMENT_STATUS.PAID;
  if (totals.refundedMinor > 0) {
    return totals.refundedMinor >= grandTotal.amount
      ? PAYMENT_STATUS.REFUNDED
      : PAYMENT_STATUS.PARTIALLY_REFUNDED;
  }
  if (totals.paidMinor <= 0) return PAYMENT_STATUS.UNPAID;
  return totals.paidMinor < grandTotal.amount ? PAYMENT_STATUS.PARTIAL : PAYMENT_STATUS.PAID;
}
