import { describe, expect, it } from "vitest";
import { formatMoney } from "./format-money.js";

const THIN_SPACE = " ";
const bdt = (amount: number) => ({ amount, currency: "BDT" });
const english = { locale: "en" } as const;

describe("formatMoney", () => {
  it("shows whole taka without paisa", () => {
    expect(formatMoney(bdt(125000), english)).toBe(`৳${THIN_SPACE}1,250`);
  });

  it("shows paisa only when non-zero", () => {
    expect(formatMoney(bdt(125050), english)).toBe(`৳${THIN_SPACE}1,250.50`);
    expect(formatMoney(bdt(5), english)).toBe(`৳${THIN_SPACE}0.05`);
  });

  it("groups South Asian style when the organization asks for it", () => {
    const options = { locale: "bn", grouping: "SOUTH_ASIAN" } as const;
    expect(formatMoney(bdt(123456700), options)).toBe(`৳${THIN_SPACE}12,34,567`);
  });

  it("groups Western style by default", () => {
    expect(formatMoney(bdt(123456700), { locale: "bn" })).toBe(`৳${THIN_SPACE}1,234,567`);
  });

  it("uses Bengali digits only when the digit script is BENGALI", () => {
    const options = { locale: "bn", digitScript: "BENGALI" } as const;
    expect(formatMoney(bdt(125000), options)).toBe(`৳${THIN_SPACE}১,২৫০`);
  });

  it("puts the minus sign before the symbol for negative amounts", () => {
    expect(formatMoney(bdt(-125050), english)).toBe(`-৳${THIN_SPACE}1,250.50`);
  });

  it("formats zero", () => {
    expect(formatMoney(bdt(0), english)).toBe(`৳${THIN_SPACE}0`);
  });

  it("rejects fractional minor units instead of rounding money", () => {
    expect(() => formatMoney(bdt(10.5), english)).toThrow(RangeError);
  });

  it("falls back to the ISO code with two fraction digits for an unknown currency", () => {
    expect(formatMoney({ amount: 1250, currency: "USD" }, english)).toBe(`USD${THIN_SPACE}12.50`);
  });
});
