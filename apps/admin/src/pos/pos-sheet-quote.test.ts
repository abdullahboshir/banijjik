import { OFFERING_KIND } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { quoteRequestOf } from "./pos-sheet-quote";
import type { CartLine } from "./cart";

describe("POS quote request", () => {
  it("includes the unit price override when a cart line has one", () => {
    const request = quoteRequestOf("0190a000-0000-7000-8000-000000000099", [
      {
        lineKey: "line-1",
        offeringId: "0190a000-0000-7000-8000-000000000001",
        variantId: "0190a000-0000-7000-8000-000000000011",
        kind: OFFERING_KIND.PRODUCT,
        offeringName: "Tea",
        variantName: "Large",
        listPrice: { amount: 4000, currency: "BDT" },
        quantity: 2,
        performedByMemberId: null,
        performerName: null,
        unitPriceOverride: { amount: 2500, currency: "BDT" },
      } satisfies CartLine,
    ]);
    expect(request.lines[0]?.unitPriceOverride).toEqual({ amount: 2500, currency: "BDT" });
  });
});
