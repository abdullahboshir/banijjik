import type { DepositRule } from "@banijjik/contracts/catalog";
import type { DepositRequired, Money } from "@banijjik/contracts/booking";
import { DEPOSIT_REQUIRED } from "@banijjik/contracts/booking";

/** Computes the deposit shown at booking creation (informational until card 3.8). */
export function computeDepositRequired(input: {
  readonly orgMode: DepositRequired;
  readonly orgValue: number;
  readonly offeringRule: DepositRule | undefined;
  readonly lineTotal: Money;
}): Money {
  const rule = input.offeringRule;
  const mode = rule?.required ?? input.orgMode;
  const value = rule?.value ?? input.orgValue;
  const { currency } = input.lineTotal;
  if (mode === DEPOSIT_REQUIRED.NONE) {
    return { amount: 0, currency };
  }
  if (mode === DEPOSIT_REQUIRED.FULL) {
    return { amount: input.lineTotal.amount, currency };
  }
  if (mode === DEPOSIT_REQUIRED.FIXED) {
    return { amount: Math.max(0, value), currency };
  }
  if (mode === DEPOSIT_REQUIRED.PERCENT) {
    const percent = Math.min(100, Math.max(1, value));
    return { amount: Math.floor((input.lineTotal.amount * percent) / 100), currency };
  }
  return { amount: 0, currency };
}
