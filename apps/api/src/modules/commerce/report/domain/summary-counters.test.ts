import { describe, expect, it } from "vitest";
import { deriveValues, emptyCounters, addCounters } from "./summary-counters.js";

describe("the read-time values", () => {
  it("the read-time values: net sales after returns, average order value with no orders, net money", () => {
    const counters = emptyCounters();
    addCounters(counters, {
      ...emptyCounters(),
      netSales: 10_000,
      ordersCompleted: 3,
      returnsValue: 2_000,
      returnsReversedValue: 500,
    });

    expect(deriveValues(counters, emptyMoney())).toMatchObject({
      netSalesAfterReturns: 8_500,
      averageOrderValue: 3_333,
    });

    expect(deriveValues(emptyCounters(), emptyMoney()).averageOrderValue).toBe(0);

    const money = {
      paidInByMethod: { CASH: 9_000, BKASH: 1_000 },
      refundedByMethod: { CASH: 2_000 },
      reversedByMethod: { BKASH: 500 },
    };
    expect(deriveValues(emptyCounters(), money).moneyInNet).toBe(7_500);
  });
});

function emptyMoney() {
  return { paidInByMethod: {}, refundedByMethod: {}, reversedByMethod: {} };
}
