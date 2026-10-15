import { describe, expect, it } from "vitest";
import { parseMoneyInput } from "./parse-money-input.js";

const TWO_FRACTION_DIGITS = 2;

describe("parseMoneyInput", () => {
  it("turns major-unit text into integer minor units", () => {
    expect(parseMoneyInput("12.50", TWO_FRACTION_DIGITS)).toEqual({ minorUnits: 1250 });
  });

  it("reads Bangla digits with an ASCII decimal point", () => {
    expect(parseMoneyInput("১২.৫০", TWO_FRACTION_DIGITS)).toEqual({ minorUnits: 1250 });
  });

  it("refuses a fraction longer than the currency allows", () => {
    expect(parseMoneyInput("12.505", TWO_FRACTION_DIGITS)).toBeUndefined();
  });

  it("keeps a negative amount as negative minor units", () => {
    expect(parseMoneyInput("-12.50", TWO_FRACTION_DIGITS)).toEqual({ minorUnits: -1250 });
  });

  it("refuses an empty value and a value that is only spaces", () => {
    expect(parseMoneyInput("", TWO_FRACTION_DIGITS)).toBeUndefined();
    expect(parseMoneyInput("   ", TWO_FRACTION_DIGITS)).toBeUndefined();
  });

  it("ignores spaces around a valid amount", () => {
    expect(parseMoneyInput(" 12.50 ", TWO_FRACTION_DIGITS)).toEqual({ minorUnits: 1250 });
  });

  it("adds tenth and fifth tenths as exact minor units", () => {
    const tenth = parseMoneyInput("0.1", TWO_FRACTION_DIGITS);
    const twoTenths = parseMoneyInput("0.2", TWO_FRACTION_DIGITS);
    expect(tenth?.minorUnits).toBe(10);
    expect(twoTenths?.minorUnits).toBe(20);
    expect((tenth?.minorUnits ?? 0) + (twoTenths?.minorUnits ?? 0)).toBe(30);
  });
});
