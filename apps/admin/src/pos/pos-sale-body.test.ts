import { describe, expect, it } from "vitest";
import { buildSaleBody } from "./pos-sale-body";

const LINE = {
  lineKey: "line-1",
  offeringId: "0190a000-0000-7000-8000-000000000001",
  variantId: "0190a000-0000-7000-8000-000000000011",
  offeringName: "Milk tea",
  variantName: "Large",
  quantity: 2,
};
const CONTACT_ID = "0190a000-0000-7000-8000-0000000000c1";

describe("sale body", () => {
  it("sends the lines and payments without a customer when none is attached", () => {
    const body = buildSaleBody({
      lines: [LINE],
      payments: [{ method: "CASH", amount: { amount: 10000, currency: "BDT" } }],
      cashTendered: null,
      contactId: null,
      storeCreditUse: null,
    });

    expect(body).not.toHaveProperty("contactId");
    expect(body).not.toHaveProperty("storeCreditUse");
    expect(body.lines[0]?.quantity).toBe(2);
  });

  it("names the customer and the store credit applied when both are set", () => {
    const body = buildSaleBody({
      lines: [LINE],
      payments: [],
      cashTendered: null,
      contactId: CONTACT_ID,
      storeCreditUse: { amount: 500, currency: "BDT" },
    });

    expect(body.contactId).toBe(CONTACT_ID);
    expect(body.storeCreditUse).toEqual({ amount: 500, currency: "BDT" });
  });
});
