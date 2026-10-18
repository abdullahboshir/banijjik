import { describe, expect, it } from "vitest";
import {
  cleanOptions,
  generateRows,
  optionsOfRows,
  variantNameOf,
  type OptionValues,
  type VariantRowKey,
} from "./variant-generator";

interface Row extends VariantRowKey {
  price: string;
}

function newRow(optionValues: OptionValues): Row {
  return { optionValues, price: "" };
}

describe("generateRows", () => {
  it("makes one row for every combination, in option order", () => {
    const { rows, isCapped } = generateRows(
      [
        { name: "Size", values: ["S", "L"] },
        { name: "Colour", values: ["Red", "Blue"] },
      ],
      [],
      newRow,
    );

    expect(isCapped).toBe(false);
    expect(rows.map((row) => variantNameOf(row.optionValues))).toEqual([
      "S / Red",
      "S / Blue",
      "L / Red",
      "L / Blue",
    ]);
  });

  it("keeps an existing row, with its id and price, when its values still exist", () => {
    const existing: Row = { variantId: "v-1", optionValues: { Size: "L" }, price: "500" };

    const { rows } = generateRows([{ name: "Size", values: ["S", "L", "XL"] }], [existing], newRow);

    expect(rows).toHaveLength(3);
    expect(rows[1]).toBe(existing);
    expect(rows[0]?.variantId).toBeUndefined();
  });

  it("leaves out the rows whose value was removed, so the API archives them", () => {
    const existing: Row = { variantId: "v-1", optionValues: { Size: "S" }, price: "100" };

    const { rows } = generateRows([{ name: "Size", values: ["L"] }], [existing], newRow);

    expect(rows.map((row) => row.optionValues)).toEqual([{ Size: "L" }]);
  });

  it("stops at 100 rows and says it was capped", () => {
    const many = Array.from({ length: 11 }, (_, index) => String(index));

    const { rows, isCapped } = generateRows(
      [
        { name: "A", values: many },
        { name: "B", values: many },
      ],
      [],
      newRow,
    );

    expect(rows).toHaveLength(100);
    expect(isCapped).toBe(true);
  });
});

describe("cleanOptions", () => {
  it("trims, drops empty and repeated values and names, and keeps three names", () => {
    const cleaned = cleanOptions([
      { name: " Size ", values: ["S", " S ", "", "L"] },
      { name: "Size", values: ["XL"] },
      { name: "", values: ["x"] },
      { name: "Colour", values: [] },
      { name: "Fit", values: ["Slim"] },
      { name: "Fabric", values: ["Cotton"] },
      { name: "Sleeve", values: ["Long"] },
    ]);

    expect(cleaned).toEqual([
      { name: "Size", values: ["S", "L"] },
      { name: "Fit", values: ["Slim"] },
      { name: "Fabric", values: ["Cotton"] },
    ]);
  });
});

describe("optionsOfRows", () => {
  it("rebuilds the option names and values from the variants of a saved offering", () => {
    const rows: VariantRowKey[] = [
      { optionValues: { Length: "Short" } },
      { optionValues: { Length: "Long" } },
    ];

    expect(optionsOfRows(rows)).toEqual([{ name: "Length", values: ["Short", "Long"] }]);
  });
});
