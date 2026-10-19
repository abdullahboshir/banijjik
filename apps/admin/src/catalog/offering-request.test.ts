import { describe, expect, it } from "vitest";
import type { OfferingResponse } from "@banijjik/contracts/catalog";
import {
  emptyRow,
  formFromOffering,
  newOfferingForm,
  type OfferingFormState,
} from "./offering-form";
import { buildOfferingPayload } from "./offering-request";

function productForm(patch: Partial<OfferingFormState> = {}): OfferingFormState {
  const form = newOfferingForm("PRODUCT", "PIECE");
  const row = { ...emptyRow(), price: "12.50", sku: "TEE-1" };
  return { ...form, name: "T-shirt", rows: [row], ...patch };
}

function payloadOf(state: OfferingFormState) {
  const result = buildOfferingPayload(state, "BDT");
  if (!result.ok) throw new Error(`unexpected errors ${JSON.stringify(result.errors)}`);
  return result.body;
}

describe("buildOfferingPayload for a simple product", () => {
  it("sends one Default variant with the price in minor units and the SKU", () => {
    const body = payloadOf(productForm());

    expect(body.name).toBe("T-shirt");
    expect(body.taxClassKey).toBeNull();
    expect(body.variants).toEqual([
      { price: { amount: 1250, currency: "BDT" }, sku: "TEE-1", unitKey: "PIECE" },
    ]);
    expect(body.kindDetails).toEqual({ requiresShipping: true });
    expect(body.description).toBeNull();
  });

  it("names the name and the price when they are missing", () => {
    const result = buildOfferingPayload(productForm({ name: " ", rows: [emptyRow()] }), "BDT");

    expect(result).toEqual({
      ok: false,
      errors: { name: "validation.required", price: "validation.required" },
    });
  });

  it("refuses a price with too many decimals", () => {
    const state = productForm();
    state.rows = [{ ...emptyRow(), price: "1.234" }];

    expect(buildOfferingPayload(state, "BDT")).toMatchObject({
      ok: false,
      errors: { price: "validation.invalid_format" },
    });
  });
});

describe("the loose rule", () => {
  it("sends min and step in grams for rice sold in kilograms", () => {
    const body = payloadOf(
      productForm({ unitKey: "KG", isLoose: true, looseMin: "250", looseStep: "250" }),
    );

    expect(body.variants[0]?.quantityRule).toEqual({ min: 250, step: 250 });
    expect(body.variants[0]?.unitKey).toBe("KG");
  });

  it("is ignored for a unit that cannot be sold loose", () => {
    const body = payloadOf(
      productForm({ unitKey: "PIECE", isLoose: true, looseMin: "1", looseStep: "1" }),
    );

    expect(body.variants[0]?.quantityRule).toBeUndefined();
  });

  it("reports a minimum below the step", () => {
    const result = buildOfferingPayload(
      productForm({ unitKey: "KG", isLoose: true, looseMin: "100", looseStep: "250" }),
      "BDT",
    );

    expect(result).toMatchObject({
      ok: false,
      errors: { quantityRule: "validation.invalid_format" },
    });
  });
});

describe("a service with a duration per variant", () => {
  it("sends the duration of the service and the longer one of the long-hair variant", () => {
    const form = newOfferingForm("SERVICE", "SESSION");
    const state: OfferingFormState = {
      ...form,
      name: "Haircut",
      details: { ...form.details, durationMinutes: "30" },
      hasOptions: true,
      options: [{ name: "Hair", values: ["Short", "Long"] }],
      rows: [
        { ...emptyRow(), optionValues: { Hair: "Short" }, price: "300" },
        { ...emptyRow(), optionValues: { Hair: "Long" }, price: "500", override: "60" },
      ],
    };

    const body = payloadOf(state);

    expect(body.kindDetails).toMatchObject({ durationMinutes: 30, bookingMode: "SLOT" });
    expect(body.variants[1]).toMatchObject({
      name: "Long",
      optionValues: { Hair: "Long" },
      price: { amount: 50000, currency: "BDT" },
      overrides: { durationMinutes: 60 },
    });
    expect(body.variants[0]?.overrides).toBeUndefined();
  });
});

describe("a plan with an admission fee", () => {
  it("sends the billing period, the fee and a month count override per variant", () => {
    const form = newOfferingForm("PLAN", "SESSION");
    const state: OfferingFormState = {
      ...form,
      name: "Gym",
      details: { ...form.details, admissionFee: "1000", capacity: "40" },
      hasOptions: true,
      options: [{ name: "Term", values: ["1 month", "3 months"] }],
      rows: [
        { ...emptyRow(), optionValues: { Term: "1 month" }, price: "1500" },
        { ...emptyRow(), optionValues: { Term: "3 months" }, price: "4000", override: "3" },
      ],
    };

    const body = payloadOf(state);

    expect(body.kindDetails).toEqual({
      billingPeriod: { unit: "MONTH", count: 1 },
      startRule: "ANY_DATE",
      admissionFee: { amount: 100000, currency: "BDT" },
      capacity: 40,
    });
    expect(body.variants[1]?.overrides).toEqual({ billingPeriod: { unit: "MONTH", count: 3 } });
  });

  it("asks for start dates when the plan starts on fixed dates", () => {
    const form = newOfferingForm("PLAN", "SESSION");
    const state: OfferingFormState = {
      ...form,
      name: "Course",
      details: { ...form.details, startRule: "FIXED_DATES" },
      rows: [{ ...emptyRow(), price: "100" }],
    };

    expect(buildOfferingPayload(state, "BDT")).toMatchObject({
      ok: false,
      errors: { startDates: "validation.required" },
    });
  });
});

describe("formFromOffering", () => {
  const stored = {
    offeringId: "o-1",
    kind: "SERVICE",
    name: "Haircut",
    slug: "haircut",
    status: "DRAFT",
    description: null,
    categories: [{ referenceId: "c-1", name: "Hair" }],
    modifierGroups: [],
    images: [{ fileId: "f-1", url: "/f-1" }],
    variants: [
      {
        variantId: "v-1",
        name: "Short",
        optionValues: { Hair: "Short" },
        price: { amount: 30000, currency: "BDT" },
        compareAtPrice: null,
        sku: null,
        barcode: null,
        unitKey: "SESSION",
        quantityRule: null,
        stockComponents: [],
        overrides: {},
        status: "ACTIVE",
      },
      {
        variantId: "v-2",
        name: "Long",
        optionValues: { Hair: "Long" },
        price: { amount: 50000, currency: "BDT" },
        compareAtPrice: null,
        sku: "LONG",
        barcode: null,
        unitKey: "SESSION",
        quantityRule: null,
        stockComponents: [],
        overrides: { durationMinutes: 60 },
        status: "ACTIVE",
      },
      { variantId: "v-3", name: "Old", optionValues: { Hair: "Old" }, status: "ARCHIVED" },
    ],
    kindDetails: { durationMinutes: 30, bufferAfterMinutes: 0, bookingMode: "SLOT" },
    customFields: {},
    version: 4,
  } as unknown as OfferingResponse;

  it("shows the active variants with their prices as typed text and keeps their ids", () => {
    const form = formFromOffering(stored);

    expect(form.hasOptions).toBe(true);
    expect(form.options).toEqual([{ name: "Hair", values: ["Short", "Long"] }]);
    expect(form.rows.map((row) => [row.variantId, row.price, row.override])).toEqual([
      ["v-1", "300", ""],
      ["v-2", "500", "60"],
    ]);
    expect(form.version).toBe(4);
  });

  it("builds the same payload back, so saving an untouched form changes nothing", () => {
    const body = payloadOf(formFromOffering(stored));

    expect(body.variants.map((variant) => variant.variantId)).toEqual(["v-1", "v-2"]);
    expect(body.imageFileIds).toEqual(["f-1"]);
    expect(body.categoryIds).toEqual(["c-1"]);
  });
});
