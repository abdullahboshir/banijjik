import type { PublicQuoteResponse } from "@banijjik/contracts/website";
import { beforeEach, describe, expect, it } from "vitest";
import { cartStore } from "./cart-store";

describe("CartStore - single location, idempotency, and quote invalidation", () => {
  beforeEach(() => {
    cartStore.clear();
  });

  it("enforces single-location guard and rejects items from different location", () => {
    // 1. Add item to location A
    const addFirst = cartStore.addItem({
      locationId: "location-dhaka-1",
      selection: {
        kind: "PRODUCT",
        offeringId: "offering-shirt",
        variantId: "variant-blue-m",
        quantity: 2,
        modifierOptionIds: [],
      },
      display: {
        offeringName: { bn: "শার্ট", en: "Shirt" },
        variantName: { bn: "ব্লু এম", en: "Blue M" },
        unitPrice: { amount: 120000, currency: "BDT" },
        mediaUrl: null,
        kind: "PRODUCT",
      },
    });

    expect(addFirst.ok).toBe(true);
    expect(cartStore.getState().locationId).toBe("location-dhaka-1");
    expect(cartStore.getState().items.length).toBe(1);

    // 2. Attempt to add item to location B -> must be rejected
    const addSecond = cartStore.addItem({
      locationId: "location-chattogram-2",
      selection: {
        kind: "PRODUCT",
        offeringId: "offering-pant",
        variantId: "variant-black-32",
        quantity: 1,
        modifierOptionIds: [],
      },
      display: {
        offeringName: { bn: "প্যান্ট", en: "Pant" },
        variantName: { bn: "কালো ৩২", en: "Black 32" },
        unitPrice: { amount: 150000, currency: "BDT" },
        mediaUrl: null,
        kind: "PRODUCT",
      },
    });

    expect(addSecond.ok).toBe(false);
    expect(addSecond.reason).toBe("LOCATION_MISMATCH");
    // Cart still belongs to location-dhaka-1 with 1 item
    expect(cartStore.getState().locationId).toBe("location-dhaka-1");
    expect(cartStore.getState().items.length).toBe(1);

    // 3. Force switch location and add
    cartStore.switchLocationAndAdd({
      locationId: "location-chattogram-2",
      selection: {
        kind: "PRODUCT",
        offeringId: "offering-pant",
        variantId: "variant-black-32",
        quantity: 1,
        modifierOptionIds: [],
      },
      display: {
        offeringName: { bn: "প্যান্ট", en: "Pant" },
        variantName: { bn: "কালো ৩২", en: "Black 32" },
        unitPrice: { amount: 150000, currency: "BDT" },
        mediaUrl: null,
        kind: "PRODUCT",
      },
    });

    expect(cartStore.getState().locationId).toBe("location-chattogram-2");
    expect(cartStore.getState().items.length).toBe(1);
    expect(cartStore.getState().items[0]?.selection.offeringId).toBe("offering-pant");
  });

  it("maintains a stable Idempotency-Key across network retries for the same cart state", () => {
    cartStore.addItem({
      locationId: "loc-1",
      selection: {
        kind: "PRODUCT",
        offeringId: "off-1",
        variantId: "var-1",
        quantity: 1,
        modifierOptionIds: [],
      },
      display: {
        offeringName: { bn: "টেস্ট", en: "Test" },
        variantName: { bn: "ভি১", en: "V1" },
        unitPrice: { amount: 50000, currency: "BDT" },
        mediaUrl: null,
        kind: "PRODUCT",
      },
    });

    const key1 = cartStore.getOrGenerateIdempotencyKey();
    expect(key1).toBeTruthy();

    // Calling it again (e.g. on network retry) must return the identical key
    const keyRetry = cartStore.getOrGenerateIdempotencyKey();
    expect(keyRetry).toBe(key1);
  });

  it("invalidates and generates a new Idempotency-Key on cart mutation", () => {
    cartStore.addItem({
      locationId: "loc-1",
      selection: {
        kind: "PRODUCT",
        offeringId: "off-1",
        variantId: "var-1",
        quantity: 1,
        modifierOptionIds: [],
      },
      display: {
        offeringName: { bn: "টেস্ট", en: "Test" },
        variantName: { bn: "ভি১", en: "V1" },
        unitPrice: { amount: 50000, currency: "BDT" },
        mediaUrl: null,
        kind: "PRODUCT",
      },
    });

    const initialKey = cartStore.getOrGenerateIdempotencyKey();
    const item = cartStore.getState().items[0];
    expect(item).toBeDefined();
    if (!item) throw new Error("Expected item");

    // Mutate cart quantity
    cartStore.updateQuantity(item.selectionId, 3);

    // Idempotency key in state must have been cleared
    expect(cartStore.getState().idempotencyKey).toBeNull();

    // Generating key now must produce a new key
    const updatedKey = cartStore.getOrGenerateIdempotencyKey();
    expect(updatedKey).not.toBe(initialKey);
  });

  it("invalidates quote when cart or fulfillment changes", () => {
    cartStore.addItem({
      locationId: "loc-1",
      selection: {
        kind: "PRODUCT",
        offeringId: "off-1",
        variantId: "var-1",
        quantity: 1,
        modifierOptionIds: [],
      },
      display: {
        offeringName: { bn: "টেস্ট", en: "Test" },
        variantName: { bn: "ভি১", en: "V1" },
        unitPrice: { amount: 50000, currency: "BDT" },
        mediaUrl: null,
        kind: "PRODUCT",
      },
    });

    const item1 = cartStore.getState().items[0];
    if (!item1) throw new Error("Expected item in cart");

    const mockQuote: PublicQuoteResponse = {
      quoteId: "quote-123",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      total: { amount: 50000, currency: "BDT" },
      lines: [
        {
          selectionId: item1.selectionId,
          subtotal: { amount: 50000, currency: "BDT" },
          discount: { amount: 0, currency: "BDT" },
          tax: { amount: 0, currency: "BDT" },
          total: { amount: 50000, currency: "BDT" },
          amountRequiredBeforeConfirmation: { amount: 0, currency: "BDT" },
        },
      ],
      deliveryCharge: { amount: 0, currency: "BDT" },
    };

    cartStore.setQuote(mockQuote);
    expect(cartStore.getState().quote).toEqual(mockQuote);

    // Changing fulfillment method must clear the cached quote
    cartStore.setFulfillment({
      method: "COURIER",
      address: {
        recipientName: "Rahim",
        phone: "01711111111",
        addressLine: "Road 1, House 2",
        districtCode: "dhaka",
        areaCode: "dhanmondi",
      },
    });

    expect(cartStore.getState().quote).toBeNull();
  });

  it("resets idempotency key and updates quote on CHECKOUT_PRICE_CHANGED refresh confirmation", () => {
    cartStore.addItem({
      locationId: "loc-1",
      selection: {
        kind: "PRODUCT",
        offeringId: "off-1",
        variantId: "var-1",
        quantity: 1,
        modifierOptionIds: [],
      },
      display: {
        offeringName: { bn: "টেস্ট", en: "Test" },
        variantName: { bn: "ভি১", en: "V1" },
        unitPrice: { amount: 50000, currency: "BDT" },
        mediaUrl: null,
        kind: "PRODUCT",
      },
    });

    const initialKey = cartStore.getOrGenerateIdempotencyKey();

    const item2 = cartStore.getState().items[0];
    if (!item2) throw new Error("Expected item in cart");

    // When price changed error occurs, refreshing quote and resetting key
    const freshQuote: PublicQuoteResponse = {
      quoteId: "quote-fresh-456",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      total: { amount: 55000, currency: "BDT" }, // price updated on server
      lines: [
        {
          selectionId: item2.selectionId,
          subtotal: { amount: 55000, currency: "BDT" },
          discount: { amount: 0, currency: "BDT" },
          tax: { amount: 0, currency: "BDT" },
          total: { amount: 55000, currency: "BDT" },
          amountRequiredBeforeConfirmation: { amount: 0, currency: "BDT" },
        },
      ],
      deliveryCharge: { amount: 0, currency: "BDT" },
    };

    cartStore.setQuote(freshQuote);
    const newKey = cartStore.resetIdempotencyKey();

    expect(newKey).not.toBe(initialKey);
    expect(cartStore.getState().quote?.total.amount).toBe(55000);
    expect(cartStore.getState().idempotencyKey).toBe(newKey);
  });

  it("converts cart items to valid CheckoutSelection DTOs", () => {
    cartStore.addItem({
      locationId: "loc-1",
      selection: {
        kind: "PRODUCT",
        offeringId: "off-1",
        variantId: "var-1",
        quantity: 2,
        modifierOptionIds: ["opt-1"],
      },
      customFields: { color: "red" },
      display: {
        offeringName: { bn: "টেস্ট", en: "Test" },
        variantName: { bn: "ভি১", en: "V1" },
        unitPrice: { amount: 50000, currency: "BDT" },
        mediaUrl: null,
        kind: "PRODUCT",
      },
    });

    const selections = cartStore.getCheckoutSelections();
    expect(selections.length).toBe(1);
    expect(selections[0]?.selectionId).toBeTruthy();
    expect(selections[0]?.selection.kind).toBe("PRODUCT");
    expect(selections[0]?.customFields).toEqual({ color: "red" });
  });
});
