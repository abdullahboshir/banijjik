import type { PosCatalogRow } from "@banijjik/contracts/pos";
import { describe, expect, it } from "vitest";
import { CATALOG_SEARCH_RESULT_LIMIT, searchCatalog } from "./catalog-search";

function row(overrides: Partial<PosCatalogRow>): PosCatalogRow {
  return {
    offeringId: "0190a000-0000-7000-8000-000000000001",
    variantId: "0190a000-0000-7000-8000-000000000011",
    kind: "PRODUCT",
    offeringName: "Milk tea",
    variantName: "Large",
    price: { amount: 15000, currency: "BDT" },
    unitKey: "PIECE",
    precision: 0,
    sku: "MT-L",
    barcode: "8901234500011",
    updatedAt: "2026-10-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("catalog search on the till", () => {
  it("finds a product by an exact barcode, ignoring case and spaces", () => {
    const rows = [row({}), row({ offeringName: "Sandwich", barcode: "1", sku: "SW" })];

    const found = searchCatalog(rows, "  8901234500011 ");

    expect(found.map((item) => item.offeringName)).toEqual(["Milk tea"]);
  });

  it("matches a typed part of the product or variant name", () => {
    const rows = [
      row({}),
      row({ offeringName: "Sandwich", variantName: "Regular", barcode: null, sku: null }),
    ];

    expect(searchCatalog(rows, "SAND").map((item) => item.offeringName)).toEqual(["Sandwich"]);
    expect(searchCatalog(rows, "large").map((item) => item.offeringName)).toEqual(["Milk tea"]);
  });

  it("returns nothing for an empty query", () => {
    expect(searchCatalog([row({})], "   ")).toEqual([]);
  });

  it("caps the list so a phone screen stays short", () => {
    const many = Array.from({ length: CATALOG_SEARCH_RESULT_LIMIT + 5 }, () => row({}));

    expect(searchCatalog(many, "milk")).toHaveLength(CATALOG_SEARCH_RESULT_LIMIT);
  });
});
