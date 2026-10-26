import { describe, expect, it } from "vitest";
import { storeCreditUseMinor } from "./till-customer";

describe("store credit at the till", () => {
  it("applies the typed amount when the balance and the bill both cover it", () => {
    expect(storeCreditUseMinor(500, 2000, 10000)).toBe(500);
  });

  it("never applies more than the customer's balance", () => {
    expect(storeCreditUseMinor(5000, 2000, 10000)).toBe(2000);
  });

  it("never applies more than the bill", () => {
    expect(storeCreditUseMinor(5000, 9000, 3000)).toBe(3000);
  });

  it("applies nothing for a negative or zero amount", () => {
    expect(storeCreditUseMinor(-100, 2000, 10000)).toBe(0);
    expect(storeCreditUseMinor(0, 2000, 10000)).toBe(0);
  });
});
