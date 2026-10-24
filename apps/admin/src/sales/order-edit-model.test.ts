import { MANUAL_DISCOUNT_TYPE } from "@banijjik/contracts/pricing";
import type { OrderResponse } from "@banijjik/contracts/sales";
import { describe, expect, it } from "vitest";
import { updateBodyOf, type EditValues } from "./order-edit-model";

const TIMESTAMP = "2026-10-24T00:00:00.000Z";
const LINE_INPUT = {
  offeringId: "offering-1",
  variantId: "variant-1",
  quantity: 2,
  modifierOptionIds: [],
  manualDiscount: { type: MANUAL_DISCOUNT_TYPE.AMOUNT, value: 500 },
};

function orderWith(overrides: Partial<OrderResponse>): OrderResponse {
  return {
    orderId: "order-1",
    orderNumber: "000001",
    invoiceNumber: null,
    locationId: "location-1",
    contactId: "contact-1",
    contactName: null,
    status: "PLACED",
    lines: [],
    totals: {
      subtotal: { amount: 0, currency: "BDT" },
      discountTotal: { amount: 0, currency: "BDT" },
      taxTotal: { amount: 0, currency: "BDT" },
      deliveryCharge: { amount: 0, currency: "BDT" },
      grandTotal: { amount: 0, currency: "BDT" },
      roundingAdjustment: { amount: 0, currency: "BDT" },
    },
    fulfillment: { method: "PICKUP" },
    paymentStatus: "UNPAID",
    businessDate: "2026-10-24",
    source: "ADMIN",
    approval: null,
    note: null,
    orderDiscount: { type: MANUAL_DISCOUNT_TYPE.PERCENT, value: 1000 },
    customFields: {},
    version: 3,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

const UNCHANGED: EditValues = {
  contact: "contact-1",
  discountType: "PERCENT",
  discountText: "10",
  note: "",
};

describe("order edit body", () => {
  it("resends every line with its manual discount and leaves unchanged fields out", () => {
    const body = updateBodyOf({
      order: orderWith({}),
      values: UNCHANGED,
      lineInputs: [LINE_INPUT],
      contactId: "contact-1",
      nextDiscount: { type: MANUAL_DISCOUNT_TYPE.PERCENT, value: 1000 },
    });
    expect(body).toEqual({ version: 3, lines: [LINE_INPUT] });
  });

  it("sends the order discount only when it changed, and null when it was removed", () => {
    const changed = updateBodyOf({
      order: orderWith({}),
      values: { ...UNCHANGED, discountText: "15" },
      lineInputs: [LINE_INPUT],
      contactId: "contact-1",
      nextDiscount: { type: MANUAL_DISCOUNT_TYPE.PERCENT, value: 1500 },
    });
    expect(changed.orderDiscount).toEqual({ type: MANUAL_DISCOUNT_TYPE.PERCENT, value: 1500 });

    const removed = updateBodyOf({
      order: orderWith({}),
      values: { ...UNCHANGED, discountType: "NONE", discountText: "" },
      lineInputs: [LINE_INPUT],
      contactId: "contact-1",
      nextDiscount: undefined,
    });
    expect(removed.orderDiscount).toBeNull();
  });

  it("sends the contact and the note only when the staff member changed them", () => {
    const body = updateBodyOf({
      order: orderWith({}),
      values: { ...UNCHANGED, contact: "contact-2", note: "  leave at the gate " },
      lineInputs: [LINE_INPUT],
      contactId: "contact-2",
      nextDiscount: { type: MANUAL_DISCOUNT_TYPE.PERCENT, value: 1000 },
    });
    expect(body.contactId).toBe("contact-2");
    expect(body.note).toBe("leave at the gate");
  });
});
