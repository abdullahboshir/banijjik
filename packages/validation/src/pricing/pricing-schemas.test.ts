import { describe, expect, it } from "vitest";
import { newId } from "@banijjik/ids";
import {
  promotionCreateRequestSchema,
  quoteRequestSchema,
  taxClassCreateRequestSchema,
  taxClassKeySchema,
} from "./pricing-schemas.js";

describe("taxClassKeySchema", () => {
  it("accepts kebab-case up to 40 characters", () => {
    expect(taxClassKeySchema.parse("vat-standard")).toBe("vat-standard");
    expect(taxClassKeySchema.safeParse("VAT").success).toBe(false);
    expect(taxClassKeySchema.safeParse("a".repeat(41)).success).toBe(false);
  });
});

describe("taxClassCreateRequestSchema", () => {
  it("accepts a zero rate", () => {
    expect(
      taxClassCreateRequestSchema.parse({
        taxClassKey: "zero",
        name: "Zero",
        rateBasisPoints: 0,
      }),
    ).toMatchObject({ rateBasisPoints: 0 });
  });
});

describe("promotionCreateRequestSchema", () => {
  it("refuses a KIND target with a non-kind id", () => {
    const result = promotionCreateRequestSchema.safeParse({
      name: "Ten percent",
      target: { scope: "KIND", ids: ["WIDGET"] },
      benefit: { type: "PERCENT", value: 1000 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a percent benefit in basis points", () => {
    const body = promotionCreateRequestSchema.parse({
      name: "Ten percent",
      target: { scope: "ALL", ids: [] },
      benefit: { type: "PERCENT", value: 1000 },
    });
    expect(body.isStackable).toBe(false);
    expect(body.benefit).toEqual({ type: "PERCENT", value: 1000 });
  });
});

describe("quoteRequestSchema", () => {
  it("requires at least one line", () => {
    expect(
      quoteRequestSchema.safeParse({
        locationId: newId(),
        lines: [],
      }).success,
    ).toBe(false);
  });

  it("accepts a cash flag and a reserved delivery charge", () => {
    const offeringId = newId();
    const body = quoteRequestSchema.parse({
      locationId: newId(),
      lines: [{ offeringId, variantId: newId(), quantity: 1 }],
      paymentIsCash: true,
      deliveryCharge: { amount: 5000, currency: "BDT" },
    });
    expect(body.paymentIsCash).toBe(true);
    expect(body.deliveryCharge?.amount).toBe(5000);
  });
});
