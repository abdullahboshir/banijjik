import { describe, expect, it } from "vitest";
import { EMPTY_CART, cartItemCount, cartReducer, lineKeyOf, type CartState } from "./cart";

const BEVERAGE = {
  offeringId: "0190a000-0000-7000-8000-000000000001",
  variantId: "0190a000-0000-7000-8000-000000000011",
  offeringName: "Milk tea",
  variantName: "Large",
};
const SANDWICH = {
  offeringId: "0190a000-0000-7000-8000-000000000002",
  variantId: "0190a000-0000-7000-8000-000000000022",
  offeringName: "Sandwich",
  variantName: "Regular",
};

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
});
