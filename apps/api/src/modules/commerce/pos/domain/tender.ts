import type { Money, PaymentMethod } from "@banijjik/contracts/payment";
import { PAYMENT_METHOD } from "@banijjik/contracts/payment";
import { POS_RULE_KEY } from "@banijjik/contracts/pos";
import { posRuleError } from "./errors.js";

export interface TenderPayment {
  readonly method: PaymentMethod;
  readonly amount: Money;
}

export interface TenderInput {
  readonly grandTotal: Money;
  readonly storeCreditUse: Money | undefined;
  readonly payments: readonly TenderPayment[];
  /** The cash the customer handed over; the part above the CASH payment is change. */
  readonly cashTendered: Money | undefined;
  readonly allowCreditSale: boolean;
  readonly hasContact: boolean;
}

export interface TenderPlan {
  readonly storeCreditMinor: number;
  readonly changeMinor: number;
  /** What stays owed on the order after every payment (a credit sale). */
  readonly dueMinor: number;
  readonly currency: Money["currency"];
}

function assertSameCurrency(input: TenderInput): void {
  const { currency } = input.grandTotal;
  const amounts = [
    ...input.payments.map((payment) => payment.amount),
    ...(input.storeCreditUse === undefined ? [] : [input.storeCreditUse]),
    ...(input.cashTendered === undefined ? [] : [input.cashTendered]),
  ];
  if (amounts.some((amount) => amount.currency !== currency)) {
    throw posRuleError(POS_RULE_KEY.CURRENCY_MISMATCH, { currency });
  }
}

function sumMinor(payments: readonly TenderPayment[], method?: PaymentMethod): number {
  return payments
    .filter((payment) => method === undefined || payment.method === method)
    .reduce((sum, payment) => sum + payment.amount.amount, 0);
}

/** Change is what the customer handed over above the cash taken for the bill (never stored as money). */
function changeOf(input: TenderInput): number {
  if (input.cashTendered === undefined) return 0;
  const cashMinor = sumMinor(input.payments, PAYMENT_METHOD.CASH);
  if (cashMinor === 0 || input.cashTendered.amount < cashMinor) {
    throw posRuleError(POS_RULE_KEY.CASH_TENDERED_INVALID);
  }
  return input.cashTendered.amount - cashMinor;
}

/**
 * Checks how a till sale is paid and works out the change and the due (11 section 4.2, plan 3.9
 * decision 4). Every payment amount is what is applied to the bill, so the total applied can never
 * pass the grand total; the excess of handed-over cash is the change, and nothing else may exceed.
 */
export function planTender(input: TenderInput): TenderPlan {
  assertSameCurrency(input);
  const totalMinor = input.grandTotal.amount;
  const storeCreditMinor = input.storeCreditUse?.amount ?? 0;
  const appliedMinor = storeCreditMinor + sumMinor(input.payments);
  const mayLeaveDue = input.allowCreditSale && input.hasContact;
  if (appliedMinor === 0 && totalMinor > 0 && !mayLeaveDue) {
    throw posRuleError(POS_RULE_KEY.TENDER_REQUIRED);
  }
  if (appliedMinor > totalMinor) {
    throw posRuleError(POS_RULE_KEY.OVERPAYMENT_NOT_CASH, {
      excessMinor: appliedMinor - totalMinor,
    });
  }
  const changeMinor = changeOf(input);
  const dueMinor = totalMinor - appliedMinor;
  if (dueMinor > 0 && !mayLeaveDue) {
    throw posRuleError(POS_RULE_KEY.PAYMENT_SHORT, { dueMinor });
  }
  return { storeCreditMinor, changeMinor, dueMinor, currency: input.grandTotal.currency };
}
