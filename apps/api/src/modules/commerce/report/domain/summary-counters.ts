import {
  REPORT_COUNTER,
  type ReportCounter,
  type ReportCounters,
  type ReportDerivedValues,
  type ReportMethodTotals,
} from "@banijjik/contracts/report";

export type MutableCounters = Record<ReportCounter, number>;

export function emptyCounters(): MutableCounters {
  const counters = {} as MutableCounters;
  for (const counter of Object.values(REPORT_COUNTER)) counters[counter] = 0;
  return counters;
}

/** Adds every counter of `source` into `target`. Sums are integer minor units, so no rounding happens. */
export function addCounters(target: MutableCounters, source: ReportCounters): void {
  for (const counter of Object.values(REPORT_COUNTER)) target[counter] += source[counter];
}

/** Adds the amounts of one method map (for example paid-in by method) into a running total. */
export function addMethodTotals(target: Record<string, number>, source: ReportMethodTotals): void {
  for (const [method, amount] of Object.entries(source)) {
    target[method] = (target[method] ?? 0) + amount;
  }
}

/**
 * The values computed at read time (plan 3.10 decision 2). Average order value is floored and
 * zero without orders, so an empty day never divides by zero.
 */
export function deriveValues(counters: ReportCounters, money: MoneyTotals): ReportDerivedValues {
  const averageOrderValue =
    counters.ordersCompleted === 0 ? 0 : Math.floor(counters.netSales / counters.ordersCompleted);
  return {
    netSalesAfterReturns: counters.netSales - counters.returnsValue + counters.returnsReversedValue,
    averageOrderValue,
    moneyInNet:
      sumValues(money.paidInByMethod) -
      sumValues(money.refundedByMethod) -
      sumValues(money.reversedByMethod),
  };
}

export interface MoneyTotals {
  readonly paidInByMethod: ReportMethodTotals;
  readonly refundedByMethod: ReportMethodTotals;
  readonly reversedByMethod: ReportMethodTotals;
}

function sumValues(totals: ReportMethodTotals): number {
  return Object.values(totals).reduce((sum, amount) => sum + amount, 0);
}
