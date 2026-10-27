import { OFFERING_KIND } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { buildSaleBody } from "./pos-sale-body";

const LINE = {
  lineKey: "line-1",
  offeringId: "0190a000-0000-7000-8000-000000000001",
  variantId: "0190a000-0000-7000-8000-000000000011",
  kind: OFFERING_KIND.PRODUCT,
  offeringName: "Milk tea",
  variantName: "Large",
  quantity: 2,
  performedByMemberId: null,
  performerName: null,
};
const SERVICE_LINE = {
  lineKey: "line-2",
  offeringId: "0190a000-0000-7000-8000-000000000002",
  variantId: "0190a000-0000-7000-8000-000000000022",
  kind: OFFERING_KIND.SERVICE,
  offeringName: "Haircut",
  variantName: "Default",
  quantity: 1,
  performedByMemberId: "0190a000-0000-7000-8000-0000000000a1",
  performerName: "Mim",
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

  it("the sale body carries performedByMemberId for a service line", () => {
    const body = buildSaleBody({
      lines: [SERVICE_LINE, LINE],
      payments: [{ method: "CASH", amount: { amount: 10000, currency: "BDT" } }],
      cashTendered: null,
      contactId: null,
      storeCreditUse: null,
    });

    expect(body.lines[0]?.performedByMemberId).toBe(SERVICE_LINE.performedByMemberId);
    expect(body.lines[1]).not.toHaveProperty("performedByMemberId");
  });
});
