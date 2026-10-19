import { describe, expect, it } from "vitest";
import { buildStockLedger } from "../index.js";

describe("StockLedger port factory", () => {
  it("exports buildStockLedger for order integration (card 3.5)", () => {
    expect(typeof buildStockLedger).toBe("function");
  });
});
