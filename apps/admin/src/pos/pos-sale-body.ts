import type { Money, PaymentMethod } from "@banijjik/contracts/payment";
import type { PosSaleBody } from "@banijjik/validation/pos";
import type { CartLine } from "./cart";

export interface SalePaymentInput {
  readonly method: PaymentMethod;
  readonly amount: Money;
}

export interface SaleBodyInput {
  readonly lines: readonly CartLine[];
  readonly payments: readonly SalePaymentInput[];
  readonly cashTendered: Money | null;
  /** The customer attached to the sale, or null for an anonymous sale. */
  readonly contactId: string | null;
  /** Store credit applied before the payments; null when none is used. */
  readonly storeCreditUse: Money | null;
}

/**
 * The body of `POST /pos/sales`. It names what the cashier picked and how it is paid, never a price:
 * the server quotes the sale and sets the location from the device (plan 3.9 decision 2).
 */
export function buildSaleBody(input: SaleBodyInput): PosSaleBody {
  const body: PosSaleBody = {
    lines: input.lines.map((line) => ({
      offeringId: line.offeringId,
      variantId: line.variantId,
      quantity: line.quantity,
      modifierOptionIds: [],
      ...(line.performedByMemberId === null
        ? {}
        : { performedByMemberId: line.performedByMemberId }),
    })),
    payments: input.payments.map((payment) => ({ method: payment.method, amount: payment.amount })),
  };
  if (input.cashTendered !== null) body.cashTendered = input.cashTendered;
  if (input.contactId !== null) body.contactId = input.contactId;
  if (input.storeCreditUse !== null) body.storeCreditUse = input.storeCreditUse;
  return body;
}
