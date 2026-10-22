import {
  PAYMENT_STATUS,
  type Money,
  type PaymentAllocation,
  type PaymentStatus,
} from "@banijjik/contracts/payment";
import {
  paymentAllocationsInvalidError,
  paymentOverpaymentRequiresContactError,
  paymentRefundExceedsPaidError,
} from "./errors.js";

export function computePaymentStatus(
  totalAmount: number,
  allocatedAmount: number,
  refundedAmount: number,
): PaymentStatus {
  const netPaid = allocatedAmount - refundedAmount;
  if (netPaid <= 0) {
    return refundedAmount > 0 ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.UNPAID;
  }
  if (netPaid >= totalAmount) {
    return PAYMENT_STATUS.PAID;
  }
  return PAYMENT_STATUS.PARTIAL;
}

export function validatePaymentAllocations(input: {
  readonly paymentAmount: Money;
  readonly allocations: readonly PaymentAllocation[];
  readonly contactId?: string | null | undefined;
  readonly isCash: boolean;
}): {
  readonly totalAllocated: number;
  readonly overpaymentAmount: number;
} {
  let totalAllocated = 0;
  for (const alloc of input.allocations) {
    if (alloc.amount.currency !== input.paymentAmount.currency) {
      throw paymentAllocationsInvalidError("Currency mismatch in payment allocations");
    }
    if (alloc.amount.amount <= 0) {
      throw paymentAllocationsInvalidError("Allocation amount must be greater than zero");
    }
    totalAllocated += alloc.amount.amount;
  }

  if (totalAllocated > input.paymentAmount.amount) {
    throw paymentAllocationsInvalidError("Total allocated exceeds payment amount");
  }

  const overpaymentAmount = input.paymentAmount.amount - totalAllocated;
  if (overpaymentAmount > 0 && !input.contactId && !input.isCash) {
    throw paymentOverpaymentRequiresContactError();
  }

  return { totalAllocated, overpaymentAmount };
}

export function validateRefundAllocations(input: {
  readonly refundAmount: Money;
  readonly allocations: readonly PaymentAllocation[];
  readonly currentPaidByRequest: ReadonlyMap<string, number>;
}): number {
  let totalAllocated = 0;
  for (const alloc of input.allocations) {
    if (alloc.amount.currency !== input.refundAmount.currency) {
      throw paymentAllocationsInvalidError("Currency mismatch in refund allocations");
    }
    if (alloc.amount.amount <= 0) {
      throw paymentAllocationsInvalidError("Allocation amount must be greater than zero");
    }
    const currentPaid = input.currentPaidByRequest.get(alloc.requestId) ?? 0;
    if (alloc.amount.amount > currentPaid) {
      throw paymentRefundExceedsPaidError();
    }
    totalAllocated += alloc.amount.amount;
  }

  if (totalAllocated > input.refundAmount.amount) {
    throw paymentAllocationsInvalidError("Total refund allocated exceeds refund amount");
  }

  return totalAllocated;
}
