import { SALES_RULE_KEY, type Money } from "@banijjik/contracts/sales";
import { salesRuleError } from "./errors.js";

/**
 * The money of an exchange (plan 3.5b E4), pure: it reads and writes nothing, so the preview and
 * the create give the same numbers. The return's credit pays the new order first; only the credit
 * this return created is spent, an older store-credit balance stays where it is.
 */
export interface SalesExchangePlanInput {
  /** The store credit the return creates (its refund, which an exchange always pays as credit). */
  readonly returnCredit: Money;
  /** The grand total of the new order. */
  readonly newOrderTotal: Money;
  /** The payments the customer makes on the new order, in the order sent. */
  readonly payments: readonly Money[];
}

export interface SalesExchangePlan {
  readonly storeCreditUsed: Money;
  readonly storeCreditLeft: Money;
  /** What the new order still owes after the credit and the payments. Never negative. */
  readonly dueAmount: Money;
}

function assertSameCurrency(money: Money, currency: Money["currency"]): void {
  if (money.currency !== currency) {
    throw salesRuleError(SALES_RULE_KEY.SALES_EXCHANGE_CURRENCY_MISMATCH);
  }
}

function sumMinor(amounts: readonly Money[]): number {
  return amounts.reduce((total, money) => total + money.amount, 0);
}

export function planSalesExchange(input: SalesExchangePlanInput): SalesExchangePlan {
  const { currency } = input.newOrderTotal;
  assertSameCurrency(input.returnCredit, currency);
  input.payments.forEach((payment) => assertSameCurrency(payment, currency));
  const creditUsedMinor = Math.min(input.returnCredit.amount, input.newOrderTotal.amount);
  const toPayMinor = input.newOrderTotal.amount - creditUsedMinor;
  if (sumMinor(input.payments) > toPayMinor) {
    throw salesRuleError(SALES_RULE_KEY.SALES_EXCHANGE_PAYMENTS_ABOVE_TOTAL);
  }
  return {
    storeCreditUsed: { amount: creditUsedMinor, currency },
    storeCreditLeft: { amount: input.returnCredit.amount - creditUsedMinor, currency },
    dueAmount: { amount: toPayMinor - sumMinor(input.payments), currency },
  };
}
