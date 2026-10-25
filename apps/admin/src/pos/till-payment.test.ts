import { PAYMENT_METHOD } from "@banijjik/contracts/payment";
import { describe, expect, it } from "vitest";
import { planTender, quickCashOptions, type TenderRow } from "./till-payment";

const TOTAL_MINOR = 125_000;
const CARD_ROW: TenderRow = { rowKey: "card", method: PAYMENT_METHOD.CARD, amountMinor: 25_000 };

function tender(rows: readonly TenderRow[], cashReceivedMinor: number) {
  return planTender({
    totalMinor: TOTAL_MINOR,
    currency: "BDT",
    rows,
    cashReceivedMinor,
  });
}

describe("till tender plan", () => {
  it("change is what the customer hands over minus the cash part of the bill", () => {
    const plan = tender([], 130_000);

    expect(plan).toMatchObject({
      ok: true,
      changeMinor: 5_000,
      cashTendered: { amount: 130_000, currency: "BDT" },
      payments: [{ method: PAYMENT_METHOD.CASH, amount: { amount: TOTAL_MINOR, currency: "BDT" } }],
    });
  });

  it("the cash part is the bill less the typed non-cash rows, so no change comes from them", () => {
    const plan = tender([CARD_ROW], 100_000);

    expect(plan).toMatchObject({
      ok: true,
      changeMinor: 0,
      payments: [
        { method: PAYMENT_METHOD.CASH, amount: { amount: 100_000, currency: "BDT" } },
        { method: PAYMENT_METHOD.CARD, amount: { amount: 25_000, currency: "BDT" } },
      ],
    });
  });

  it("a non-cash overpayment is refused, because only cash can be handed back", () => {
    const plan = tender([{ ...CARD_ROW, amountMinor: TOTAL_MINOR + 100 }], 0);

    expect(plan).toEqual({ ok: false, refusal: "overpaymentNotCash" });
  });

  it("cash handed over short of the cash part is refused", () => {
    expect(tender([], TOTAL_MINOR - 1)).toEqual({ ok: false, refusal: "cashShort" });
  });

  it("a cash row, a negative or a fractional amount is refused before any sum", () => {
    const cashRow: TenderRow = { rowKey: "c", method: PAYMENT_METHOD.CASH, amountMinor: 1 };
    const fractional: TenderRow = { ...CARD_ROW, amountMinor: 1.5 };

    expect(tender([cashRow], TOTAL_MINOR)).toEqual({ ok: false, refusal: "invalidAmount" });
    expect(tender([fractional], TOTAL_MINOR)).toEqual({ ok: false, refusal: "invalidAmount" });
  });

  it("refuses more payments than a sale may carry", () => {
    const rows: TenderRow[] = Array.from({ length: 5 }, (_, index) => ({
      ...CARD_ROW,
      rowKey: `row-${index}`,
      amountMinor: 1,
    }));

    expect(tender(rows, TOTAL_MINOR)).toEqual({ ok: false, refusal: "tooManyRows" });
  });
});

describe("quick cash figures", () => {
  it("offers the exact amount first, then distinct round figures above it", () => {
    expect(quickCashOptions(125_000)).toEqual([125_000, 130_000, 150_000, 200_000]);
  });

  it("drops a round figure that equals the bill", () => {
    expect(quickCashOptions(10_000)).toEqual([10_000, 50_000, 100_000]);
  });
});
