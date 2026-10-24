import { describe, expect, it } from "vitest";
import { CURRENCY_CODE } from "@banijjik/contracts";
import { requiredAdvance } from "./required-advance.js";

const total = { amount: 101, currency: CURRENCY_CODE.BDT };
describe("the required order advance", () => {
  it("caps FIXED at the grand total", () => {
    expect(requiredAdvance(total, "FIXED", 500)).toEqual(total);
    expect(requiredAdvance(total, "FIXED", 30).amount).toBe(30);
  });
  it("rounds PERCENT up and clamps 150 to 100 percent", () => {
    expect(requiredAdvance(total, "PERCENT", 25).amount).toBe(26);
    expect(requiredAdvance(total, "PERCENT", 150)).toEqual(total);
    expect(requiredAdvance(total, "PERCENT", 0).amount).toBe(0);
  });
  it("requires the whole grand total for FULL and zero for NONE", () => {
    expect(requiredAdvance(total, "FULL", 0)).toEqual(total);
    expect(requiredAdvance(total, "NONE", 500).amount).toBe(0);
  });
  it("rounds safe minor-unit totals without overflowing intermediate multiplication", () => {
    const large = { ...total, amount: Number.MAX_SAFE_INTEGER };
    expect(requiredAdvance(large, "PERCENT", 100)).toEqual(large);
  });
});
