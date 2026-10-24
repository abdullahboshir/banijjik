import { describe, expect, it } from "vitest";
import { settleReturn } from "./sales-return-settlement.js";

describe("settleReturn", () => {
  it("computes due reduced and refund from total and net paid for an unpaid order", () => {
    expect(settleReturn({ totalMinor: 1000, netPaidMinor: 0, valueMinor: 300 })).toEqual({
      newTotalMinor: 700,
      dueReducedMinor: 300,
      refundMinor: 0,
    });
  });

  it("lowers the due first for a partly paid order and refunds only the paid excess", () => {
    expect(settleReturn({ totalMinor: 1000, netPaidMinor: 400, valueMinor: 300 })).toEqual({
      newTotalMinor: 700,
      dueReducedMinor: 300,
      refundMinor: 0,
    });
    expect(settleReturn({ totalMinor: 1000, netPaidMinor: 400, valueMinor: 800 })).toEqual({
      newTotalMinor: 200,
      dueReducedMinor: 600,
      refundMinor: 200,
    });
  });

  it("refunds the whole value of a fully paid order", () => {
    expect(settleReturn({ totalMinor: 1000, netPaidMinor: 1000, valueMinor: 1000 })).toEqual({
      newTotalMinor: 0,
      dueReducedMinor: 0,
      refundMinor: 1000,
    });
  });

  it("refunds the overpaid amount above the new total", () => {
    expect(settleReturn({ totalMinor: 1000, netPaidMinor: 1200, valueMinor: 100 })).toEqual({
      newTotalMinor: 900,
      dueReducedMinor: 0,
      refundMinor: 300,
    });
  });
});
