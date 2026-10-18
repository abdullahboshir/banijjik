import { VARIANT_STATUS } from "@banijjik/contracts/catalog";
import { asId, newId, type CategoryId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { assertParentFits } from "./category.entity.js";
import { firstFreeSlug, slugFromName } from "./slug.js";
import { foldText } from "./name-search.js";
import { hasPriceChange, variantIdentityOf, type Variant } from "./variant.js";
import { assertKindDetailsCurrency, mergeVariants, type VariantDraft } from "./variant-merge.js";
import { mergeOptions, assertSelectionRules } from "./modifier-group.entity.js";

const BDT = "BDT" as const;
const price = (amount: number) => ({ amount, currency: BDT });

function draft(extra: Partial<VariantDraft> = {}): VariantDraft {
  return { price: price(100), unitKey: "PIECE", ...extra };
}

function existingVariant(extra: Partial<Variant> = {}): Variant {
  return {
    variantId: newId(),
    name: "Default",
    optionValues: {},
    price: price(100),
    compareAtPrice: undefined,
    sku: undefined,
    barcode: undefined,
    unitKey: "PIECE",
    quantityRule: undefined,
    stockComponents: [],
    overrides: {},
    status: VARIANT_STATUS.ACTIVE,
    ...extra,
  };
}

describe("slugFromName", () => {
  it("kebab-cases the Latin letters and digits of a name", () => {
    const options = { prefix: "o", recordId: newId() };

    expect(slugFromName("  Basmati Rice (5 kg) ", options)).toBe("basmati-rice-5-kg");
    expect(slugFromName("Café Latte", options)).toBe("cafe-latte");
  });

  it("falls back to the prefix and the end of the id for a Bangla name", () => {
    const recordId = newId();

    expect(slugFromName("মিনিকেট চাল", { prefix: "o", recordId })).toBe(`o-${recordId.slice(-8)}`);
  });

  it("numbers a slug that is taken", () => {
    expect(firstFreeSlug("tea", new Set())).toBe("tea");
    expect(firstFreeSlug("tea", new Set(["tea", "tea-2"]))).toBe("tea-3");
  });
});

describe("foldText", () => {
  it("lower-cases and composes Bangla letters so every keyboard matches", () => {
    expect(foldText("  RICE ")).toBe("rice");
    expect(foldText("য" + "়")).toBe(foldText("য়"));
    expect(foldText("চা‍ল")).toBe(foldText("চাল"));
  });
});

describe("mergeVariants", () => {
  it("issues an id to a new variant and names it from its options", () => {
    const merged = mergeVariants({
      existing: [],
      drafts: [draft({ optionValues: { size: "XL", color: "Red" } }), draft({ name: "Plain" })],
      currency: BDT,
    });

    expect(merged[0]?.name).toBe("XL / Red");
    expect(merged[1]?.name).toBe("Plain");
    expect(merged[0]?.variantId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps the id of a variant that is sent again and archives one that is left out", () => {
    const kept = existingVariant({ name: "A", optionValues: { size: "A" } });
    const dropped = existingVariant({ name: "B", optionValues: { size: "B" } });

    const merged = mergeVariants({
      existing: [kept, dropped],
      drafts: [
        draft({ variantId: kept.variantId, optionValues: { size: "A" }, price: price(250) }),
      ],
      currency: BDT,
    });

    expect(merged.find((variant) => variant.variantId === kept.variantId)).toMatchObject({
      status: "ACTIVE",
      price: price(250),
    });
    expect(merged.find((variant) => variant.variantId === dropped.variantId)).toMatchObject({
      status: "ARCHIVED",
      name: "B",
    });
  });

  it("tells variants without options apart by name, case-insensitively", () => {
    expect(() =>
      mergeVariants({
        existing: [],
        drafts: [draft({ name: "Long" }), draft({ name: "long" })],
        currency: BDT,
      }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    expect(variantIdentityOf(existingVariant({ name: "Long" })).key).toBe("name:long");
  });

  it("refuses a variant id it does not know and the same id sent twice", () => {
    const known = existingVariant();

    expect(() =>
      mergeVariants({ existing: [known], drafts: [draft({ variantId: newId() })], currency: BDT }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    expect(() =>
      mergeVariants({
        existing: [known],
        drafts: [
          draft({ variantId: known.variantId, name: "One" }),
          draft({ variantId: known.variantId, name: "Two" }),
        ],
        currency: BDT,
      }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("refuses a price or compare-at price in another currency", () => {
    const foreign = { amount: 100, currency: "USD" as never };

    expect(() =>
      mergeVariants({ existing: [], drafts: [draft({ price: foreign })], currency: BDT }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    expect(() =>
      mergeVariants({ existing: [], drafts: [draft({ compareAtPrice: foreign })], currency: BDT }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("refuses a repeated SKU inside one offering", () => {
    expect(() =>
      mergeVariants({
        existing: [],
        drafts: [draft({ name: "A", sku: "S1" }), draft({ name: "B", sku: "S1" })],
        currency: BDT,
      }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("refuses a stock component with a business rule until inventory items exist", () => {
    expect(() =>
      mergeVariants({
        existing: [],
        drafts: [draft({ stockComponents: [{ inventoryItemId: newId(), quantity: 1 }] })],
        currency: BDT,
      }),
    ).toThrow(expect.objectContaining({ code: "BUSINESS_RULE" }));
  });

  it("refuses more than 100 variants in total, archived ones included", () => {
    const archived = Array.from({ length: 100 }, (_unused, index) =>
      existingVariant({ name: `Old ${index}`, status: VARIANT_STATUS.ARCHIVED }),
    );

    expect(() => mergeVariants({ existing: archived, drafts: [draft()], currency: BDT })).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
  });
});

describe("hasPriceChange", () => {
  it("is true only when a variant that existed before has another price", () => {
    const before = existingVariant();

    expect(hasPriceChange([before], [{ ...before, price: price(200) }])).toBe(true);
    expect(hasPriceChange([before], [{ ...before, name: "Renamed" }])).toBe(false);
    expect(hasPriceChange([before], [before, existingVariant({ price: price(5) })])).toBe(false);
  });
});

describe("assertKindDetailsCurrency", () => {
  it("refuses money in kindDetails that is not in the organization's currency", () => {
    const details = {
      billingPeriod: { unit: "MONTH", count: 1 },
      admissionFee: { amount: 1, currency: "USD" },
    } as never;

    expect(() => assertKindDetailsCurrency(details, BDT)).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
  });
});

describe("assertParentFits", () => {
  const id = (): CategoryId => asId<CategoryId>(newId());

  it("allows a category under a root and refuses a fourth level", () => {
    expect(() =>
      assertParentFits({ categoryId: undefined, ancestorIds: [newId()], subtreeDepth: 0 }),
    ).not.toThrow();
    expect(() =>
      assertParentFits({
        categoryId: undefined,
        ancestorIds: [newId(), newId(), newId()],
        subtreeDepth: 0,
      }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("counts the levels that hang below the category being moved", () => {
    expect(() =>
      assertParentFits({ categoryId: id(), ancestorIds: [newId(), newId()], subtreeDepth: 1 }),
    ).toThrow();
    expect(() =>
      assertParentFits({ categoryId: id(), ancestorIds: [newId()], subtreeDepth: 1 }),
    ).not.toThrow();
  });

  it("refuses a parent chain that contains the category itself", () => {
    const self = id();

    expect(() =>
      assertParentFits({ categoryId: self, ancestorIds: [newId(), self], subtreeDepth: 0 }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });
});

describe("modifier groups", () => {
  const option = (name: string, status: "ACTIVE" | "ARCHIVED" = "ACTIVE") => ({
    modifierOptionId: newId(),
    name,
    priceDelta: price(0),
    status,
  });

  it("archives an option that is left out of the list", () => {
    const first = option("A");
    const second = option("B");

    const merged = mergeOptions({
      existing: [first, second],
      drafts: [
        {
          modifierOptionId: first.modifierOptionId,
          name: "A2",
          priceDelta: price(5),
          status: "ACTIVE",
        },
      ],
      currency: BDT,
    });

    expect(merged.map((item) => [item.name, item.status])).toEqual([
      ["A2", "ACTIVE"],
      ["B", "ARCHIVED"],
    ]);
  });

  it("counts only ACTIVE options when it checks the maximum", () => {
    const options = [option("A"), option("B", "ARCHIVED")];

    expect(() =>
      assertSelectionRules({
        selection: "MULTIPLE",
        isRequired: false,
        minSelect: 0,
        maxSelect: 2,
        options,
      }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    expect(() =>
      assertSelectionRules({
        selection: "SINGLE",
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        options,
      }),
    ).not.toThrow();
  });
});
