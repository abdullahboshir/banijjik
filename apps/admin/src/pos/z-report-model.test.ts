import { describe, expect, it } from "vitest";
import type { PosZReport } from "@banijjik/contracts/pos";
import { buildZReportModel } from "./z-report-model";

const money = (amount: number) => ({ amount, currency: "BDT" as const });

const REPORT: PosZReport = {
  zReportNumber: "Z-000012",
  posSessionId: "0190a000-0000-7000-8000-0000000000aa",
  posDeviceId: "0190a000-0000-7000-8000-0000000000bb",
  locationId: "0190a000-0000-7000-8000-0000000000cc",
  openedByMemberId: "0190a000-0000-7000-8000-0000000000dd",
  openedAt: "2026-10-25T03:00:00.000Z",
  closedByMemberId: "0190a000-0000-7000-8000-0000000000dd",
  closedAt: "2026-10-25T11:00:00.000Z",
  salesCount: 3,
  gross: money(30000),
  discount: money(1000),
  tax: money(1500),
  grandTotal: money(30500),
  paymentsIn: [
    { method: "CASH", total: money(20000), count: 2 },
    { method: "BKASH", total: money(10000), count: 1 },
  ],
  collections: [],
  refunds: [{ method: "CASH", total: money(500), count: 1 }],
  returns: {
    count: 1,
    value: money(500),
    refunds: [{ method: "CASH", total: money(500), count: 1 }],
  },
  storeCreditUsed: money(0),
  duesCreated: money(0),
  openingFloat: money(5000),
  expectedCash: money(24500),
  countedCash: money(24000),
  variance: money(-500),
};

describe("Z-report model", () => {
  it("keeps the server numbers and the sales totals as sent", () => {
    const model = buildZReportModel(REPORT);

    expect(model.zReportNumber).toBe("Z-000012");
    expect(model.salesCount).toBe(3);
    expect(model.salesGrandTotal).toEqual(money(30500));
    expect(model.variance).toEqual(money(-500));
  });

  it("lists each method row in the order the server sent it", () => {
    const model = buildZReportModel(REPORT);

    expect(model.receivedByMethod.rows.map((row) => row.method)).toEqual(["CASH", "BKASH"]);
    expect(model.receivedByMethod.rows[0]).toEqual({
      method: "CASH",
      count: 2,
      total: money(20000),
    });
  });

  it("keeps empty method groups empty and returns separate from sales", () => {
    const model = buildZReportModel(REPORT);

    expect(model.collectedByMethod.rows).toEqual([]);
    expect(model.returnsCount).toBe(1);
    expect(model.returnsRefundedByMethod.rows).toHaveLength(1);
    expect(model.refundedByMethod.rows[0]?.total).toEqual(money(500));
  });
});
