import { describe, expect, it } from "vitest";
import { POSTING_KEY, SYSTEM_ACCOUNT_CODE } from "@banijjik/contracts/accounting";
import { draftOrderCompleted, type OrderPostingSnapshot } from "./order-posting-rules.js";
const money = (amount: number) => ({ amount, currency: "BDT" as const });
function snapshot(serviceGoods: number): OrderPostingSnapshot {
  return {
    orderId: "order",
    businessDate: "2026-10-26",
    locationId: "location",
    totals: {
      subtotal: money(1500),
      discountTotal: money(150),
      taxTotal: money(135),
      deliveryCharge: money(0),
      grandTotal: money(1486),
      roundingAdjustment: money(1),
    },
    serviceGoods: money(serviceGoods),
    advancesToSettle: money(0),
    cogs: money(0),
  };
}
function creditFor(
  lines: readonly { accountCode: string; credit: { amount: number } }[],
  code: string,
): number {
  return lines.find((line) => line.accountCode === code)?.credit.amount ?? 0;
}

describe("walk-in order posting", () => {
  it("draftOrderCompleted splits goods between product and service revenue", () => {
    for (const serviceGoods of [0, 1000, 1500]) {
      const drafts = draftOrderCompleted(snapshot(serviceGoods));
      expect(drafts).toHaveLength(1);
      const journal = drafts[0];
      if (journal === undefined) throw new Error("expected revenue journal");
      expect(journal.postingKey).toBe(POSTING_KEY.order_revenue);
      const lines = journal.lines;
      expect(lines.reduce((sum, line) => sum + line.debit.amount - line.credit.amount, 0)).toBe(0);
      const service = lines.find(
        (line) => line.accountCode === SYSTEM_ACCOUNT_CODE.REVENUE_SERVICE,
      );
      const product = lines.find(
        (line) => line.accountCode === SYSTEM_ACCOUNT_CODE.REVENUE_PRODUCT,
      );
      expect(creditFor(lines, SYSTEM_ACCOUNT_CODE.REVENUE_SERVICE)).toBe(serviceGoods);
      expect(creditFor(lines, SYSTEM_ACCOUNT_CODE.REVENUE_PRODUCT)).toBe(1500 - serviceGoods);
      if (serviceGoods === 1500) expect(product).toBeUndefined();
      if (serviceGoods === 0) expect(service).toBeUndefined();
      expect(
        lines.find((line) => line.accountCode === SYSTEM_ACCOUNT_CODE.SALES_DISCOUNTS)?.debit
          .amount,
      ).toBe(150);
      expect(
        lines.find((line) => line.accountCode === SYSTEM_ACCOUNT_CODE.TAX_PAYABLE)?.credit.amount,
      ).toBe(135);
      expect(
        lines.find((line) => line.accountCode === SYSTEM_ACCOUNT_CODE.ROUNDING)?.credit.amount,
      ).toBe(1);
    }
  });
  it("refuses service goods above the goods total", () => {
    expect(() => draftOrderCompleted(snapshot(1501))).toThrowError(
      expect.objectContaining({ code: "INTERNAL" }),
    );
  });
});
