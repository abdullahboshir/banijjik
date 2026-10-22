import type { BillingPeriod, Money } from "@banijjik/contracts/catalog";

const DAY_MILLISECONDS = 86_400_000;
const MONTHS_PER_YEAR = 12;
const DAYS_PER_WEEK = 7;
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MILLISECONDS).toISOString().slice(0, 10);
}
export function daysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MILLISECONDS);
}
/** Clamp the day before constructing the target date: JS otherwise rolls 31 February into March. */
export function addBillingPeriod(date: string, period: BillingPeriod): string {
  if (period.unit === "DAY") return addDays(date, period.count);
  if (period.unit === "WEEK") return addDays(date, period.count * DAYS_PER_WEEK);
  const source = new Date(date);
  const months = period.unit === "YEAR" ? period.count * MONTHS_PER_YEAR : period.count;
  const target = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(source.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}
export function addMoney(left: Money, right: Money): Money {
  if (left.currency !== right.currency) throw new RangeError("Currency mismatch");
  const amount = left.amount + right.amount;
  if (!Number.isSafeInteger(amount)) throw new RangeError("Money exceeds safe integer range");
  return { amount, currency: left.currency };
}
