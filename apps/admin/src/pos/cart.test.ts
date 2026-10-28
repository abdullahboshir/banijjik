import { OFFERING_KIND } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import {
  EMPTY_CART,
  heldCartPayloadOf,
  cartItemCount,
  cartReducer,
  cartLinesFromHeldPayload,
  lineKeyOf,
  quantityControlOf,
  usesWeightKeypad,
  type CartState,
} from "./cart";

const BEVERAGE = {
  offeringId: "0190a000-0000-7000-8000-000000000001",
  variantId: "0190a000-0000-7000-8000-000000000011",
  kind: OFFERING_KIND.PRODUCT,
  offeringName: "Milk tea",
  variantName: "Large",
  listPrice: { amount: 4000, currency: "BDT" as const },
  unitPriceOverride: null,
  performedByMemberId: null,
  performerName: null,
};
const SANDWICH = {
  offeringId: "0190a000-0000-7000-8000-000000000002",
  variantId: "0190a000-0000-7000-8000-000000000022",
  kind: OFFERING_KIND.PRODUCT,
  offeringName: "Sandwich",
  variantName: "Regular",
  listPrice: { amount: 5000, currency: "BDT" as const },
  unitPriceOverride: null,
  performedByMemberId: null,
  performerName: null,
};
const HAIRCUT = {
  offeringId: "0190a000-0000-7000-8000-000000000003",
  variantId: "0190a000-0000-7000-8000-000000000033",
  kind: OFFERING_KIND.SERVICE,
  offeringName: "Haircut",
  variantName: "Default",
  listPrice: { amount: 3000, currency: "BDT" as const },
  unitPriceOverride: null,
  performedByMemberId: null,
  performerName: null,
};
const STYLIST_MEMBER_ID = "0190a000-0000-7000-8000-0000000000a1";

describe("cart reducer", () => {
  it("adds a scanned product as one line and counts it again on a second scan", () => {
    const once = cartReducer(EMPTY_CART, { type: "add", line: BEVERAGE });
    const twice = cartReducer(once, { type: "add", line: BEVERAGE });

    expect(twice.lines).toHaveLength(1);
    expect(twice.lines[0]?.quantity).toBe(2);
    expect(cartItemCount(twice)).toBe(2);
  });

  it("keeps two products as two lines in the order they were added", () => {
    const withTwo = cartReducer(cartReducer(EMPTY_CART, { type: "add", line: BEVERAGE }), {
      type: "add",
      line: SANDWICH,
      quantity: 3,
    });

    expect(withTwo.lines.map((line) => line.variantId)).toEqual([
      BEVERAGE.variantId,
      SANDWICH.variantId,
    ]);
    expect(cartItemCount(withTwo)).toBe(4);
  });

  it("removes a line when its quantity is set below one", () => {
    const withBeverage = cartReducer(EMPTY_CART, { type: "add", line: BEVERAGE });
    const lineKey = lineKeyOf(BEVERAGE.variantId);

    const changed = cartReducer(withBeverage, { type: "setQuantity", lineKey, quantity: 0 });

    expect(changed.lines).toEqual([]);
  });

  it("changes only the quantity of the chosen line", () => {
    const withTwo: CartState = cartReducer(
      cartReducer(EMPTY_CART, { type: "add", line: BEVERAGE }),
      { type: "add", line: SANDWICH },
    );

    const changed = cartReducer(withTwo, {
      type: "setQuantity",
      lineKey: lineKeyOf(SANDWICH.variantId),
      quantity: 5,
    });

    expect(changed.lines.map((line) => line.quantity)).toEqual([1, 5]);
  });

  it("removes one line and clears the whole cart", () => {
    const withTwo = cartReducer(cartReducer(EMPTY_CART, { type: "add", line: BEVERAGE }), {
      type: "add",
      line: SANDWICH,
    });

    const removedOne = cartReducer(withTwo, {
      type: "remove",
      lineKey: lineKeyOf(BEVERAGE.variantId),
    });
    const cleared = cartReducer(removedOne, { type: "clear" });

    expect(removedOne.lines.map((line) => line.variantId)).toEqual([SANDWICH.variantId]);
    expect(cleared).toEqual(EMPTY_CART);
  });

  it("the till cart gives a service line a whole-number stepper and no weight keypad", () => {
    const added = cartReducer(EMPTY_CART, { type: "add", line: HAIRCUT });
    const service = added.lines[0];
    if (service === undefined) throw new Error("the cart should hold the service");
    const stepped = cartReducer(added, {
      type: "setQuantity",
      lineKey: lineKeyOf(HAIRCUT.variantId),
      quantity: 2.7,
    });

    expect(quantityControlOf(service)).toBe("stepper");
    expect(usesWeightKeypad(service)).toBe(false);
    expect(stepped.lines[0]?.quantity).toBe(2);
  });

  it("keeps the performer on a service line when the same service is scanned again", () => {
    const withCut = cartReducer(EMPTY_CART, { type: "add", line: HAIRCUT });
    const named = cartReducer(withCut, {
      type: "setPerformer",
      lineKey: lineKeyOf(HAIRCUT.variantId),
      performedByMemberId: STYLIST_MEMBER_ID,
      performerName: "Mim",
    });
    const scannedAgain = cartReducer(named, { type: "add", line: HAIRCUT });

    expect(scannedAgain.lines).toHaveLength(1);
    expect(scannedAgain.lines[0]?.quantity).toBe(2);
    expect(scannedAgain.lines[0]?.performedByMemberId).toBe(STYLIST_MEMBER_ID);
    expect(scannedAgain.lines[0]?.performerName).toBe("Mim");
  });

  it("holding a cart stores lines and contact without prices and restores them", () => {
    const withService = cartReducer(EMPTY_CART, { type: "add", line: HAIRCUT });
    const named = cartReducer(withService, {
      type: "setPerformer",
      lineKey: lineKeyOf(HAIRCUT.variantId),
      performedByMemberId: STYLIST_MEMBER_ID,
      performerName: "Mim",
    });

    const payload = heldCartPayloadOf(named.lines, "0190a000-0000-7000-8000-0000000000c1");
    expect(payload).toEqual({
      contactId: "0190a000-0000-7000-8000-0000000000c1",
      lines: [
        {
          offeringId: HAIRCUT.offeringId,
          variantId: HAIRCUT.variantId,
          quantity: 1,
          modifierOptionIds: [],
          performedByMemberId: STYLIST_MEMBER_ID,
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain("price");
    expect(
      cartLinesFromHeldPayload(
        payload,
        [
          {
            offeringId: HAIRCUT.offeringId,
            variantId: HAIRCUT.variantId,
            kind: HAIRCUT.kind,
            offeringName: HAIRCUT.offeringName,
            variantName: HAIRCUT.variantName,
            price: HAIRCUT.listPrice,
            unitKey: "SESSION",
            precision: 1,
            sku: null,
            barcode: null,
            updatedAt: "2026-10-27T00:00:00.000Z",
          },
        ],
        [{ memberId: STYLIST_MEMBER_ID, name: "Mim" }],
      ),
    ).toMatchObject([
      {
        variantId: HAIRCUT.variantId,
        quantity: 1,
        performedByMemberId: STYLIST_MEMBER_ID,
        performerName: "Mim",
        listPrice: HAIRCUT.listPrice,
        unitPriceOverride: null,
      },
    ]);
  });
});
