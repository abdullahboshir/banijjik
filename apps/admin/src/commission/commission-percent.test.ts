import { describe, expect, it } from "vitest";
import { percentTextOf, percentTextToBasisPoints } from "./commission-percent";

describe("percentTextToBasisPoints", () => {
  it("turns the three boundary percents into integer basis points", () => {
    expect(percentTextToBasisPoints("0.01")).toBe(1);
    expect(percentTextToBasisPoints("12.5")).toBe(1250);
    expect(percentTextToBasisPoints("100")).toBe(10_000);
  });

  it("accepts Bengali digits like every money field does", () => {
    expect(percentTextToBasisPoints("১২.৫")).toBe(1250);
  });

  it("refuses a zero, more than 100 % and more than two decimals", () => {
    expect(percentTextToBasisPoints("0")).toBeUndefined();
    expect(percentTextToBasisPoints("0.00")).toBeUndefined();
    expect(percentTextToBasisPoints("100.01")).toBeUndefined();
    expect(percentTextToBasisPoints("12.345")).toBeUndefined();
  });

  it("refuses text that is not a percent", () => {
    expect(percentTextToBasisPoints("")).toBeUndefined();
    expect(percentTextToBasisPoints(" 12 % ")).toBeUndefined();
    expect(percentTextToBasisPoints("-5")).toBeUndefined();
  });
});

describe("percentTextOf", () => {
  it("shows the stored basis points without a trailing zero", () => {
    expect(percentTextOf(1)).toBe("0.01");
    expect(percentTextOf(1250)).toBe("12.5");
    expect(percentTextOf(10_000)).toBe("100");
  });
});
