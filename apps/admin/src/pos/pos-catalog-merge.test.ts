import { describe, expect, it } from "vitest";
import type { PosCatalogRow } from "@banijjik/contracts/pos";
import { mergeCatalogRows } from "./pos-catalog-merge";

function rowOf(offeringId: string, price: number): PosCatalogRow {
  return {
    offeringId,
    variantId: `${offeringId}-v`,
    kind: "PRODUCT",
    offeringName: offeringId,
    variantName: "Regular",
    price: { amount: price, currency: "BDT" },
    unitKey: "PIECE",
    precision: 0,
    sku: null,
    barcode: null,
    updatedAt: "2026-10-25T10:00:00.000Z",
  };
}

describe("catalog cache merge", () => {
  it("replaces a changed row with its new price and keeps the rest", () => {
    const merged = mergeCatalogRows([rowOf("a", 100), rowOf("b", 200)], [rowOf("a", 150)], []);

    expect(merged).toHaveLength(2);
    expect(merged.find((row) => row.offeringId === "a")?.price.amount).toBe(150);
  });

  it("drops a removed variant from the cache", () => {
    const merged = mergeCatalogRows(
      [rowOf("a", 100), rowOf("b", 200)],
      [],
      [{ offeringId: "b", variantId: "b-v" }],
    );

    expect(merged.map((row) => row.offeringId)).toEqual(["a"]);
  });
});
