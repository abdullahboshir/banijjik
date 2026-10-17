import { describe, expect, it } from "vitest";
import { modifierGroupCreateRequestSchema } from "./category-schemas.js";
import { offeringCreateRequestSchema, offeringUpdateRequestSchema } from "./offering-schemas.js";

const BDT = "BDT";
const price = (amount: number) => ({ amount, currency: BDT });

function issuePaths(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  return (result.error?.issues ?? []).map((issue) => issue.path.map(String).join("."));
}

const haircut = {
  kind: "SERVICE",
  name: "Haircut",
  kindDetails: { durationMinutes: 30 },
  price: price(50000),
  unitKey: "SESSION",
};

describe("offeringCreateRequestSchema", () => {
  it("applies the defaults of the kind to kindDetails", () => {
    const parsed = offeringCreateRequestSchema.parse(haircut);

    expect(parsed.kindDetails).toMatchObject({
      durationMinutes: 30,
      bufferAfterMinutes: 0,
      requiresResource: false,
      bookingMode: "SLOT",
      maxAdvanceDays: 60,
      resourceTypeKeys: [],
    });
  });

  it("accepts a product with no kindDetails and gives it the product defaults", () => {
    const parsed = offeringCreateRequestSchema.parse({
      kind: "PRODUCT",
      name: "Rice",
      price: price(9000),
    });

    expect(parsed.kindDetails).toEqual({ requiresShipping: true });
  });

  it("refuses a service field on a product, at kindDetails", () => {
    const result = offeringCreateRequestSchema.safeParse({
      kind: "PRODUCT",
      name: "Rice",
      price: price(9000),
      kindDetails: { durationMinutes: 30 },
    });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("kindDetails");
  });

  it("refuses a missing required field of the kind, such as the billing period of a plan", () => {
    const result = offeringCreateRequestSchema.safeParse({
      kind: "PLAN",
      name: "Monthly",
      price: price(100000),
      unitKey: "SESSION",
    });

    expect(issuePaths(result)).toContain("kindDetails.billingPeriod");
  });

  it("refuses money with a float amount", () => {
    const result = offeringCreateRequestSchema.safeParse({ ...haircut, price: price(12.5) });

    expect(issuePaths(result)).toContain("price.amount");
  });

  it("refuses a negative price and an unknown currency", () => {
    expect(offeringCreateRequestSchema.safeParse({ ...haircut, price: price(-1) }).success).toBe(
      false,
    );
    expect(
      offeringCreateRequestSchema.safeParse({ ...haircut, price: { amount: 1, currency: "USD" } })
        .success,
    ).toBe(false);
  });

  it("refuses an unknown unit", () => {
    const result = offeringCreateRequestSchema.safeParse({ ...haircut, unitKey: "DOZEN" });

    expect(issuePaths(result)).toContain("unitKey");
  });

  it("needs either variants or a price, never both or neither", () => {
    const variant = { price: price(100), unitKey: "PIECE" };

    expect(offeringCreateRequestSchema.safeParse({ kind: "PRODUCT", name: "A" }).success).toBe(
      false,
    );
    expect(
      offeringCreateRequestSchema.safeParse({
        kind: "PRODUCT",
        name: "A",
        price: price(1),
        variants: [variant],
      }).success,
    ).toBe(false);
    expect(
      offeringCreateRequestSchema.safeParse({ kind: "PRODUCT", name: "A", variants: [variant] })
        .success,
    ).toBe(true);
  });

  it("refuses a compare-at price below the price", () => {
    const result = offeringCreateRequestSchema.safeParse({
      kind: "PRODUCT",
      name: "A",
      variants: [{ price: price(500), compareAtPrice: price(400), unitKey: "PIECE" }],
    });

    expect(issuePaths(result)).toContain("variants.0.compareAtPrice");
  });

  it("refuses more than 100 variants", () => {
    const variants = Array.from({ length: 101 }, (_, index) => ({
      name: `V${index}`,
      price: price(100),
      unitKey: "PIECE",
    }));

    expect(
      offeringCreateRequestSchema.safeParse({ kind: "PRODUCT", name: "A", variants }).success,
    ).toBe(false);
  });

  it.each([
    ["step 0", { min: 250, step: 0 }],
    ["min below step", { min: 100, step: 250 }],
    ["max below min", { min: 250, step: 250, max: 100 }],
    ["a fraction", { min: 250.5, step: 250 }],
  ])("refuses a bad quantity rule: %s", (_label, quantityRule) => {
    const result = offeringCreateRequestSchema.safeParse({
      kind: "PRODUCT",
      name: "Rice",
      variants: [{ price: price(9000), unitKey: "KG", quantityRule }],
    });

    expect(result.success).toBe(false);
  });

  it("accepts the loose rice rule of the plan", () => {
    const result = offeringCreateRequestSchema.safeParse({
      kind: "PRODUCT",
      name: "Rice",
      variants: [{ price: price(9000), unitKey: "KG", quantityRule: { min: 250, step: 250 } }],
    });

    expect(result.success).toBe(true);
  });

  it("refuses an override that the kind does not allow", () => {
    const result = offeringCreateRequestSchema.safeParse({
      kind: "SERVICE",
      name: "Haircut",
      kindDetails: { durationMinutes: 30 },
      variants: [{ price: price(100), unitKey: "SESSION", overrides: { weightGrams: 5 } }],
    });

    expect(issuePaths(result)).toContain("variants.0.overrides");
  });

  it("accepts the duration override of a service variant", () => {
    const result = offeringCreateRequestSchema.safeParse({
      kind: "SERVICE",
      name: "Haircut",
      kindDetails: { durationMinutes: 30 },
      variants: [
        {
          name: "Long hair",
          price: price(100),
          unitKey: "SESSION",
          overrides: { durationMinutes: 60 },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("checks plan fixed dates and rental night times", () => {
    const plan = {
      kind: "PLAN",
      name: "Batch",
      price: price(1),
      unitKey: "SESSION",
      kindDetails: { billingPeriod: { unit: "MONTH", count: 1 }, startRule: "FIXED_DATES" },
    };

    expect(offeringCreateRequestSchema.safeParse(plan).success).toBe(false);
    expect(
      offeringCreateRequestSchema.safeParse({
        ...plan,
        kindDetails: { ...plan.kindDetails, startDates: ["2026-11-01"] },
      }).success,
    ).toBe(true);
    expect(
      offeringCreateRequestSchema.safeParse({
        kind: "RENTAL",
        name: "Room",
        price: price(1),
        unitKey: "DAY",
        kindDetails: { rateUnit: "HOUR", checkInTime: "14:00" },
      }).success,
    ).toBe(false);
  });
});

describe("offeringUpdateRequestSchema", () => {
  it("needs a version and one other field", () => {
    expect(offeringUpdateRequestSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(offeringUpdateRequestSchema.safeParse({ name: "New" }).success).toBe(false);
    expect(offeringUpdateRequestSchema.safeParse({ name: "New", version: 1 }).success).toBe(true);
  });

  it("does not take a kind: it is immutable", () => {
    expect(
      offeringUpdateRequestSchema.safeParse({ kind: "SERVICE", name: "x", version: 1 }).success,
    ).toBe(false);
  });
});

describe("modifierGroupCreateRequestSchema", () => {
  const options = [
    { name: "Extra cheese", priceDelta: price(2000) },
    { name: "Bacon", priceDelta: price(3000) },
  ];

  it("accepts a required single choice and an optional multiple choice", () => {
    expect(
      modifierGroupCreateRequestSchema.safeParse({
        name: "Size",
        selection: "SINGLE",
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        options,
      }).success,
    ).toBe(true);
    expect(
      modifierGroupCreateRequestSchema.safeParse({
        name: "Toppings",
        selection: "MULTIPLE",
        isRequired: false,
        minSelect: 0,
        maxSelect: 2,
        options,
      }).success,
    ).toBe(true);
  });

  it.each([
    [
      "a single choice with max 2",
      { selection: "SINGLE", isRequired: false, minSelect: 0, maxSelect: 2 },
    ],
    [
      "required with min 0",
      { selection: "MULTIPLE", isRequired: true, minSelect: 0, maxSelect: 2 },
    ],
    ["min above max", { selection: "MULTIPLE", isRequired: true, minSelect: 3, maxSelect: 2 }],
    [
      "optional with min 1",
      { selection: "MULTIPLE", isRequired: false, minSelect: 1, maxSelect: 2 },
    ],
  ])("refuses %s", (_label, selection) => {
    expect(
      modifierGroupCreateRequestSchema.safeParse({ name: "G", options, ...selection }).success,
    ).toBe(false);
  });
});
