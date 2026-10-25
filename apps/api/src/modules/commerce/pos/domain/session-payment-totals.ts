import type { PaymentDirection, PaymentMethod } from "@banijjik/contracts/payment";

/** One sum of a register's payments, as the payment module's session read reports it. */
export interface SessionMethodTotal {
  readonly method: PaymentMethod;
  readonly direction: PaymentDirection;
  readonly currency: string;
  readonly totalMinor: number;
  readonly count: number;
}

/** What a register's payments allocated to one order, in and refunded. */
export interface SessionOrderAllocation {
  readonly orderId: string;
  readonly allocatedMinor: number;
  readonly refundedMinor: number;
}
