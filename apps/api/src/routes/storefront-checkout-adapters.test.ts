import { CURRENCY_CODE } from "@banijjik/contracts";
import type { OrderLineSnapshot } from "@banijjik/contracts/sales";
import { describe, expect, it } from "vitest";
import { projectStorefrontOrderItems } from "./storefront-checkout-adapters.js";

describe("storefront order tracking projection", () => {
  it("returns customer-safe line data without internal seller or cost fields", () => {
    const unitPrice = { amount: 1200, currency: CURRENCY_CODE.BDT };
    const internalLine: OrderLineSnapshot = {
      orderLineId: "line-1",
      offeringId: "offering-1",
      variantId: "variant-1",
      kind: "PRODUCT",
      nameSnapshot: "Tea",
      quantity: 2,
      unitPrice,
      listUnitPrice: { amount: 1500, currency: CURRENCY_CODE.BDT },
      unitPriceOverride: { amount: 1000, currency: CURRENCY_CODE.BDT },
      lineGross: { amount: 3000, currency: CURRENCY_CODE.BDT },
      lineDiscount: { amount: 600, currency: CURRENCY_CODE.BDT },
      lineTax: { amount: 0, currency: CURRENCY_CODE.BDT },
      lineNetTotal: { amount: 2400, currency: CURRENCY_CODE.BDT },
      unitCostSnapshot: { amount: 500, currency: CURRENCY_CODE.BDT },
      modifiers: [],
      returnedQuantity: 0,
      promotionIds: ["promotion-1"],
      taxClassKey: "standard",
      manualDiscount: { type: "AMOUNT", value: 600 },
      performedByMemberId: "member-1",
    };

    expect(projectStorefrontOrderItems([internalLine])).toEqual([
      { name: "Tea", quantity: 2, unitPrice },
    ]);
  });
});
