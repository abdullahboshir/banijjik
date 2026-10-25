import { PAYMENT_DIRECTION, PAYMENT_METHOD, type Money } from "@banijjik/contracts/payment";
import { POS_RULE_KEY } from "@banijjik/contracts/pos";
import type { SessionMethodTotal } from "./session-payment-totals.js";
import { posRuleError } from "./errors.js";

/**
 * What the drawer should hold: the float, plus cash taken, minus cash refunded, for this session
 * only (plan 3.9 decision 5). Card, bKash, Nagad, bank and store credit never enter the drawer.
 */
export function expectedCash(input: {
  readonly openingFloat: Money;
  readonly methodTotals: readonly SessionMethodTotal[];
}): Money {
  const { openingFloat } = input;
  let amount = openingFloat.amount;
  for (const row of input.methodTotals) {
    if (row.method !== PAYMENT_METHOD.CASH) continue;
    if (row.currency !== openingFloat.currency) {
      throw posRuleError(POS_RULE_KEY.CURRENCY_MISMATCH, { currency: openingFloat.currency });
    }
    if (row.direction === PAYMENT_DIRECTION.IN) amount += row.totalMinor;
    if (row.direction === PAYMENT_DIRECTION.REFUND) amount -= row.totalMinor;
  }
  return { amount, currency: openingFloat.currency };
}
