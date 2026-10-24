import { OFFERING_KIND } from "@banijjik/contracts";
import {
  OFFERING_STATUS,
  UNIT_KEY,
  VARIANT_STATUS,
  type OfferingResponse,
  type QuantityRule,
  type VariantResponse,
} from "@banijjik/contracts/catalog";
import { MANUAL_DISCOUNT_TYPE, type QuoteResponse } from "@banijjik/contracts/pricing";
import type { OrderResponse } from "@banijjik/contracts/sales";
import { describe, expect, it } from "vitest";
import {
  discountToText,
  emptyOrderLine,
  lineInputsOfDrafts,
  manualDiscountTotalOf,
  parseLineDraft,
  parseLineQuantity,
  parseManualDiscount,
  requiredGroupMissing,
  storedLineInputs,
  variantOf,
} from "./order-lines";

const TIMESTAMP = "2026-10-24T00:00:00.000Z";

function variantWith(quantityRule: QuantityRule | null): VariantResponse {
  return {
    variantId: "variant-1",
    name: "১ কেজি",
    optionValues: {},
    price: { amount: 12000, currency: "BDT" },
    compareAtPrice: null,
    sku: "RICE-1KG",
    barcode: null,
    unitKey: UNIT_KEY.KG,
    quantityRule,
    stockComponents: [],
    overrides: {},
    status: VARIANT_STATUS.ACTIVE,
  };
}

function offeringWith(quantityRule: QuantityRule | null): OfferingResponse {
  return {
    offeringId: "offering-1",
    kind: OFFERING_KIND.PRODUCT,
    name: "চাল",
    slug: "rice",
    status: OFFERING_STATUS.ACTIVE,
    description: null,
    categories: [],
    modifierGroups: [],
    images: [],
    variants: [variantWith(quantityRule)],
    kindDetails: { requiresShipping: false },
    taxClassKey: null,
    synonyms: [],
    customFields: {},
    version: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

describe("parseLineQuantity", () => {
  it("reads Bengali digits as the same number", () => {
    expect(parseLineQuantity("২", null)).toBe(2);
    expect(parseLineQuantity("১০", null)).toBe(10);
  });

  it("accepts any whole amount above zero when the variant has no rule", () => {
    expect(parseLineQuantity("3", null)).toBe(3);
  });

  it("refuses a fraction, zero, a blank and a sign", () => {
    expect(parseLineQuantity("1.5", null)).toBeUndefined();
    expect(parseLineQuantity("0", null)).toBeUndefined();
    expect(parseLineQuantity("", null)).toBeUndefined();
    expect(parseLineQuantity("-2", null)).toBeUndefined();
  });

  it("honours the loose rule's minimum and step", () => {
    const rule = { min: 1, step: 1 };
    expect(parseLineQuantity("2", rule)).toBe(2);
    expect(parseLineQuantity("0", rule)).toBeUndefined();
  });

  it("honours a larger step and a maximum", () => {
    const rule = { min: 5, step: 5, max: 20 };
    expect(parseLineQuantity("5", rule)).toBe(5);
    expect(parseLineQuantity("10", rule)).toBe(10);
    expect(parseLineQuantity("7", rule)).toBeUndefined();
    expect(parseLineQuantity("25", rule)).toBeUndefined();
  });
});

describe("parseManualDiscount", () => {
  it("is absent when the choice is no discount", () => {
    expect(parseManualDiscount("NONE", "10")).toBeUndefined();
  });

  it("reads a percent as basis points", () => {
    expect(parseManualDiscount(MANUAL_DISCOUNT_TYPE.PERCENT, "10")).toEqual({
      type: "PERCENT",
      value: 1000,
    });
    expect(parseManualDiscount(MANUAL_DISCOUNT_TYPE.PERCENT, "৭.৫")).toEqual({
      type: "PERCENT",
      value: 750,
    });
  });

  it("reads an amount as minor units", () => {
    expect(parseManualDiscount(MANUAL_DISCOUNT_TYPE.AMOUNT, "50.25")).toEqual({
      type: "AMOUNT",
      value: 5025,
    });
  });

  it("refuses a percent above one hundred, zero, a negative and unreadable text", () => {
    expect(parseManualDiscount(MANUAL_DISCOUNT_TYPE.PERCENT, "100")).toEqual({
      type: "PERCENT",
      value: 10_000,
    });
    expect(parseManualDiscount(MANUAL_DISCOUNT_TYPE.PERCENT, "100.01")).toBeUndefined();
    expect(parseManualDiscount(MANUAL_DISCOUNT_TYPE.AMOUNT, "0")).toBeUndefined();
    expect(parseManualDiscount(MANUAL_DISCOUNT_TYPE.AMOUNT, "-5")).toBeUndefined();
    expect(parseManualDiscount(MANUAL_DISCOUNT_TYPE.AMOUNT, "five")).toBeUndefined();
  });
});

describe("discountToText", () => {
  it("shows no discount as an empty rule", () => {
    expect(discountToText(null)).toEqual({ type: "NONE", text: "" });
  });

  it("writes whole values without a fraction and keeps two fraction digits otherwise", () => {
    expect(discountToText({ type: "PERCENT", value: 1000 })).toEqual({
      type: "PERCENT",
      text: "10",
    });
    expect(discountToText({ type: "AMOUNT", value: 5050 })).toEqual({
      type: "AMOUNT",
      text: "50.50",
    });
    expect(discountToText({ type: "AMOUNT", value: 5005 })).toEqual({
      type: "AMOUNT",
      text: "50.05",
    });
  });
});

describe("parseLineDraft", () => {
  it("is empty until a product is picked", () => {
    expect(parseLineDraft(emptyOrderLine("draft-1"))).toEqual({ kind: "empty" });
  });

  it("reports a quantity the variant's rule refuses", () => {
    const draft = {
      ...emptyOrderLine("draft-1"),
      offering: offeringWith({ min: 1, step: 1 }),
      quantity: "1.5",
    };
    expect(parseLineDraft(draft)).toEqual({ kind: "invalid", field: "quantity" });
  });

  it("reports a discount that cannot be read", () => {
    const draft = {
      ...emptyOrderLine("draft-1"),
      offering: offeringWith(null),
      quantity: "2",
      discountType: MANUAL_DISCOUNT_TYPE.AMOUNT,
      discountText: "0",
    };
    expect(parseLineDraft(draft)).toEqual({ kind: "invalid", field: "discount" });
  });

  it("builds the line input the API takes, with the first variant when none was chosen", () => {
    const draft = {
      ...emptyOrderLine("draft-1"),
      offering: offeringWith(null),
      quantity: "২",
      modifierOptionIds: ["modifier-1"],
      discountType: MANUAL_DISCOUNT_TYPE.PERCENT,
      discountText: "5",
    };
    expect(parseLineDraft(draft)).toEqual({
      kind: "ok",
      input: {
        offeringId: "offering-1",
        variantId: "variant-1",
        quantity: 2,
        modifierOptionIds: ["modifier-1"],
        manualDiscount: { type: "PERCENT", value: 500 },
      },
    });
  });

  it("leaves an absent discount out of the input", () => {
    const draft = {
      ...emptyOrderLine("draft-1"),
      offering: offeringWith(null),
      quantity: "1",
    };
    const parsed = parseLineDraft(draft);
    expect(parsed.kind).toBe("ok");
    expect(parsed.kind === "ok" ? "manualDiscount" in parsed.input : true).toBe(false);
  });
});

describe("lineInputsOfDrafts", () => {
  it("keeps only the lines that are picked and valid, in order", () => {
    const picked = {
      ...emptyOrderLine("draft-1"),
      offering: offeringWith(null),
      quantity: "2",
    };
    const unpicked = emptyOrderLine("draft-2");
    expect(lineInputsOfDrafts([picked, unpicked]).map((input) => input.quantity)).toEqual([2]);
  });
});

describe("variantOf", () => {
  it("uses the chosen variant, or the first one when the draft names none", () => {
    const offering = offeringWith(null);
    expect(variantOf({ ...emptyOrderLine("draft-1"), offering })?.variantId).toBe("variant-1");
    expect(
      variantOf({ ...emptyOrderLine("draft-1"), offering, variantId: "missing" })?.variantId,
    ).toBe("variant-1");
    expect(variantOf(emptyOrderLine("draft-1"))).toBeUndefined();
  });
});

describe("storedLineInputs", () => {
  const order = {
    lines: [
      {
        orderLineId: "line-1",
        offeringId: "offering-1",
        variantId: "variant-1",
        quantity: 3,
        modifiers: [
          {
            modifierGroupId: "group-1",
            modifierOptionId: "modifier-1",
            nameSnapshot: "m",
            priceDelta: { amount: 500, currency: "BDT" },
          },
        ],
        manualDiscount: { type: MANUAL_DISCOUNT_TYPE.PERCENT, value: 500 },
      },
      {
        orderLineId: "line-2",
        offeringId: "offering-2",
        variantId: "variant-2",
        quantity: 1,
        modifiers: [],
        manualDiscount: null,
      },
    ],
  } as unknown as OrderResponse;

  it("resends every stored line's manual discount and modifiers (Amendment 1)", () => {
    expect(storedLineInputs(order)).toEqual([
      {
        offeringId: "offering-1",
        variantId: "variant-1",
        quantity: 3,
        modifierOptionIds: ["modifier-1"],
        manualDiscount: { type: "PERCENT", value: 500 },
      },
      {
        offeringId: "offering-2",
        variantId: "variant-2",
        quantity: 1,
        modifierOptionIds: [],
      },
    ]);
  });

  it("leaves a line with no manual discount without the field", () => {
    const second = storedLineInputs(order)[1];
    expect(second === undefined ? "missing" : "manualDiscount" in second).toBe(false);
  });
});

describe("manualDiscountTotalOf", () => {
  it("adds only the manual discounts, never a promotion", () => {
    const quote = {
      lines: [
        { manualDiscount: { amount: 500, currency: "BDT" } },
        { manualDiscount: { amount: 250, currency: "BDT" } },
      ],
      totals: {},
    } as unknown as QuoteResponse;
    expect(manualDiscountTotalOf(quote)).toBe(750);
  });

  it("is zero without a quote", () => {
    expect(manualDiscountTotalOf(undefined)).toBe(0);
  });
});

describe("requiredGroupMissing", () => {
  const group = {
    modifierGroupId: "group-1",
    name: "সাইজ",
    selection: "SINGLE",
    isRequired: true,
    minSelect: 1,
    maxSelect: 1,
    options: [
      { modifierOptionId: "modifier-1", name: "বড়", priceDelta: { amount: 0, currency: "BDT" } },
    ],
  } as unknown as Parameters<typeof requiredGroupMissing>[0][number];

  it("is true until a required group has its options", () => {
    expect(requiredGroupMissing([group], [])).toBe(true);
    expect(requiredGroupMissing([group], ["modifier-1"])).toBe(false);
  });
});
