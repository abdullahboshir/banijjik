import type { Money } from "@banijjik/contracts/accounting";
import { describe, expect, it } from "vitest";
import { businessDateOf } from "./business-date.js";
import { refundAdjustmentDelta } from "./reconcile-commission.js";

function bdt(amount: number): Money {
  return { amount, currency: "BDT" };
}

const ACCRUAL = bdt(1000);
const GROSS = bdt(10_000);

function delta(refunded: number, currentNet: number): number {
  return refundAdjustmentDelta({
    accrual: ACCRUAL,
    sourceGrossTotal: GROSS,
    refunded: bdt(refunded),
    currentNet: bdt(currentNet),
  });
}

describe("refundAdjustmentDelta", () => {
  it("lowers the commission by half for a half refund", () => {
    expect(delta(5000, 1000)).toBe(-500);
  });

  it("removes exactly the accrual for a full refund, with no rounding leftover", () => {
    const oddAccrual = bdt(333);
    const result = refundAdjustmentDelta({
      accrual: oddAccrual,
      sourceGrossTotal: bdt(3000),
      refunded: bdt(3000),
      currentNet: oddAccrual,
    });
    expect(result).toBe(-333);
  });

  it("builds the target from the cumulative refund, so partial refunds add up to the full one", () => {
    const first = delta(3333, 1000);
    const second = refundAdjustmentDelta({
      accrual: ACCRUAL,
      sourceGrossTotal: GROSS,
      refunded: bdt(10_000),
      currentNet: bdt(1000 + first),
    });
    expect(1000 + first + second).toBe(0);
  });

  it("caps a refund above the gross total", () => {
    expect(delta(50_000, 1000)).toBe(-1000);
  });

  it("restores the accrual when a refund is reversed", () => {
    expect(delta(0, 500)).toBe(500);
  });

  it("finds nothing to write when the ledger already matches (a replay)", () => {
    expect(delta(5000, 500)).toBe(0);
  });

  it("writes nothing for a source with a gross total of zero", () => {
    const result = refundAdjustmentDelta({
      accrual: bdt(0),
      sourceGrossTotal: bdt(0),
      refunded: bdt(0),
      currentNet: bdt(0),
    });
    expect(result).toBe(0);
  });
});

describe("businessDateOf", () => {
  it("uses the organization local date: 02:00 in Dhaka is still the previous day in UTC", () => {
    const twoAmDhaka = new Date("2026-10-22T20:00:00Z");
    expect(businessDateOf(twoAmDhaka, "Asia/Dhaka")).toBe("2026-10-23");
    expect(twoAmDhaka.toISOString().slice(0, 10)).toBe("2026-10-22");
  });

  it("keeps the same date for an afternoon instant", () => {
    expect(businessDateOf(new Date("2026-10-23T09:00:00Z"), "Asia/Dhaka")).toBe("2026-10-23");
  });
});
