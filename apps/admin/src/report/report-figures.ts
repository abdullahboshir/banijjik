import type {
  ReportCounter,
  ReportDayRow,
  ReportMethodTotals,
  ReportPeriodValues,
} from "@banijjik/contracts/report";

/** The figures one day (or a total) shows in the table and the CSV, in the order of the columns. */
export interface ReportFigures {
  readonly orders: number;
  readonly netAfterReturns: number;
  readonly bookingsCompleted: number;
  readonly moneyIn: number;
  readonly refunds: number;
  readonly expenses: number;
  readonly netMoney: number;
}

export interface ReportDayFigures extends ReportFigures {
  readonly businessDate: string;
}

/** Sums the amounts of one payment-method map (money in, refunds or reversals). */
export function sumMethodTotals(totals: ReportMethodTotals): number {
  return Object.values(totals).reduce((sum, amount) => sum + amount, 0);
}

function counterOf(values: ReportPeriodValues, counter: ReportCounter): number {
  return values.counters[counter];
}

/** Maps one period of the API to the columns the reports page and the CSV show. */
export function figuresOf(values: ReportPeriodValues): ReportFigures {
  return {
    orders: counterOf(values, "ordersCompleted"),
    netAfterReturns: values.derived.netSalesAfterReturns,
    bookingsCompleted: counterOf(values, "bookingsCompleted"),
    moneyIn: sumMethodTotals(values.paidInByMethod),
    refunds: sumMethodTotals(values.refundedByMethod),
    expenses: counterOf(values, "expensesTotal"),
    netMoney: values.derived.moneyInNet,
  };
}

export function dayFiguresOf(row: ReportDayRow): ReportDayFigures {
  return { businessDate: row.businessDate, ...figuresOf(row.values) };
}

/** The chart shows one bar per day: the net sales after returns of that day. */
export function netAfterReturnsBars(
  rows: readonly ReportDayFigures[],
): readonly { readonly label: string; readonly value: number }[] {
  return rows.map((row) => ({ label: row.businessDate, value: row.netAfterReturns })).reverse();
}
