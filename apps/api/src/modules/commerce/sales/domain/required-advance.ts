import {
  SALES_ADVANCE_REQUIRED,
  type SalesAdvanceRequired,
  type Money,
} from "@banijjik/contracts/sales";
const PERCENT_BASE = 100n;
/** Integer arithmetic avoids overflow before rounding a percentage of safe minor units. */
export function requiredAdvance(total: Money, rule: SalesAdvanceRequired, value: number): Money {
  if (rule === SALES_ADVANCE_REQUIRED.NONE) return { ...total, amount: 0 };
  if (rule === SALES_ADVANCE_REQUIRED.FULL) return total;
  const nonnegativeValue = Math.max(0, value);
  if (rule === SALES_ADVANCE_REQUIRED.FIXED)
    return { ...total, amount: Math.min(nonnegativeValue, total.amount) };
  const percent = BigInt(Math.min(100, nonnegativeValue));
  const amount = Number((BigInt(total.amount) * percent + PERCENT_BASE - 1n) / PERCENT_BASE);
  return { ...total, amount };
}
