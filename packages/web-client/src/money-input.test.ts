import { describe, expect, it } from "vitest";
import { moneyFromInput, moneyToInputText } from "./money-input.js";

describe("moneyFromInput", () => {
  it("turns taka with paisa into integer minor units", () => {
    expect(moneyFromInput("12.50", "BDT")).toEqual({ amount: 1250, currency: "BDT" });
  });

  it("reads Bangla digits", () => {
    expect(moneyFromInput("১২.৫০", "BDT")).toEqual({ amount: 1250, currency: "BDT" });
  });

  it("does not drift on amounts that floats get wrong", () => {
    expect(moneyFromInput("0.29", "BDT")?.amount).toBe(29);
    expect(moneyFromInput("1.15", "BDT")?.amount).toBe(115);
  });

  it("refuses empty, negative and over-precise text", () => {
    expect(moneyFromInput("", "BDT")).toBeUndefined();
    expect(moneyFromInput("-5", "BDT")).toBeUndefined();
    expect(moneyFromInput("1.234", "BDT")).toBeUndefined();
    expect(moneyFromInput("abc", "BDT")).toBeUndefined();
  });
});

describe("moneyToInputText", () => {
  it("shows whole taka without a fraction and trims a trailing zero", () => {
    expect(moneyToInputText({ amount: 1200, currency: "BDT" })).toBe("12");
    expect(moneyToInputText({ amount: 1250, currency: "BDT" })).toBe("12.5");
    expect(moneyToInputText({ amount: 1205, currency: "BDT" })).toBe("12.05");
  });

  it("round-trips through moneyFromInput", () => {
    const money = { amount: 99905, currency: "BDT" } as const;
    expect(moneyFromInput(moneyToInputText(money), "BDT")).toEqual(money);
  });
});
