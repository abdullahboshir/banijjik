import { describe, expect, it } from "vitest";
import { formatNumber } from "./format-number.js";

describe("formatNumber", () => {
  it("groups digits Western style and keeps decimals", () => {
    expect(formatNumber(1234567.25, { locale: "en" })).toBe("1,234,567.25");
  });

  it("groups digits South Asian style", () => {
    expect(formatNumber(1234567, { locale: "bn", grouping: "SOUTH_ASIAN" })).toBe("12,34,567");
  });

  it("converts to Bengali digits on request", () => {
    expect(formatNumber(1250.5, { locale: "bn", digitScript: "BENGALI" })).toBe("১,২৫০.৫");
  });

  it("keeps the sign of negative numbers", () => {
    expect(formatNumber(-1500, { locale: "en" })).toBe("-1,500");
  });

  it("rejects values that are not finite", () => {
    expect(() => formatNumber(Number.NaN, { locale: "en" })).toThrow(RangeError);
  });
});
