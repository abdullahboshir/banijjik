import { describe, expect, it } from "vitest";
import {
  figuresOf,
  netAfterReturnsBars,
  sumMethodTotals,
  type ReportDayFigures,
} from "./report-figures";

function dayWith(businessDate: string, netAfterReturns: number): ReportDayFigures {
  return {
    businessDate,
    netAfterReturns,
    orders: 0,
    bookingsCompleted: 0,
    moneyIn: 0,
    refunds: 0,
    expenses: 0,
    netMoney: 0,
  };
}

describe("report figures", () => {
  it("sums the amounts of every payment method", () => {
    expect(sumMethodTotals({ CASH: 500, CARD: 250 })).toBe(750);
    expect(sumMethodTotals({})).toBe(0);
  });

  it("orders the chart bars from the oldest day to the newest", () => {
    const rows = [dayWith("2026-10-26", 300), dayWith("2026-10-25", 100)];
    expect(netAfterReturnsBars(rows).map((bar) => bar.label)).toEqual(["2026-10-25", "2026-10-26"]);
  });

  it("maps a period to the columns of the reports page", () => {
    const figures = figuresOf({
      counters: { ordersCompleted: 2, bookingsCompleted: 1, expensesTotal: 40 } as never,
      paidInByMethod: { CASH: 600 },
      refundedByMethod: { CASH: 100 },
      reversedByMethod: {},
      derived: { netSalesAfterReturns: 900, averageOrderValue: 450, moneyInNet: 500 },
    });
    expect(figures).toEqual({
      orders: 2,
      netAfterReturns: 900,
      bookingsCompleted: 1,
      moneyIn: 600,
      refunds: 100,
      expenses: 40,
      netMoney: 500,
    });
  });
});
