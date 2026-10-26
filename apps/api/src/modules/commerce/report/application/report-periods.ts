import type { ReportPeriodValues } from "@banijjik/contracts/report";
import {
  addCounters,
  addMethodTotals,
  deriveValues,
  emptyCounters,
} from "../domain/summary-counters.js";
import type { DailySummaryRow } from "./ports/report-ports.js";

/** Sums the rows of one period (a day, the month to date, or a range) into its values. */
export function periodOf(rows: readonly DailySummaryRow[]): ReportPeriodValues {
  const counters = emptyCounters();
  const paidInByMethod: Record<string, number> = {};
  const refundedByMethod: Record<string, number> = {};
  const reversedByMethod: Record<string, number> = {};
  for (const row of rows) {
    addCounters(counters, row.counters);
    addMethodTotals(paidInByMethod, row.paidInByMethod);
    addMethodTotals(refundedByMethod, row.refundedByMethod);
    addMethodTotals(reversedByMethod, row.reversedByMethod);
  }
  return {
    counters,
    paidInByMethod,
    refundedByMethod,
    reversedByMethod,
    derived: deriveValues(counters, { paidInByMethod, refundedByMethod, reversedByMethod }),
  };
}

/** The rows of one day, grouped by business date. A day without rows is simply absent. */
export function rowsByDay(rows: readonly DailySummaryRow[]): Map<string, DailySummaryRow[]> {
  const grouped = new Map<string, DailySummaryRow[]>();
  for (const row of rows) {
    const dayRows = grouped.get(row.businessDate) ?? [];
    dayRows.push(row);
    grouped.set(row.businessDate, dayRows);
  }
  return grouped;
}
