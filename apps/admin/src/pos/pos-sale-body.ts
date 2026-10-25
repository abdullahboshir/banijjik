import type { Money, PaymentMethod } from "@banijjik/contracts/payment";
import type { PosSaleBody } from "@banijjik/validation/pos";
import type { CartLine } from "./cart";

export interface SalePaymentInput {
  readonly method: PaymentMethod;
  readonly amount: Money;
}

/**
 * The body of `POST /pos/sales`. It names what the cashier picked and how it is paid, never a price:
 * the server quotes the sale and sets the location from the device (plan 3.9 decision 2).
 */
export function buildSaleBody(input: {
  readonly lines: readonly CartLine[];
  readonly payments: readonly SalePaymentInput[];
  readonly cashTendered: Money | null;
}): PosSaleBody {
  const body: PosSaleBody = {
    lines: input.lines.map((line) => ({
      offeringId: line.offeringId,
      variantId: line.variantId,
      quantity: line.quantity,
      modifierOptionIds: [],
    })),
    payments: input.payments.map((payment) => ({ method: payment.method, amount: payment.amount })),
  };
  if (input.cashTendered === null) return body;
  return { ...body, cashTendered: input.cashTendered };
}
