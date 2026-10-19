import { describe, expect, it } from "vitest";
import { newId } from "@banijjik/ids";
import {
  PROMOTION_BENEFIT_TYPE,
  PROMOTION_STATUS,
  PROMOTION_TARGET_SCOPE,
} from "@banijjik/contracts/pricing";
import { computeQuote, type QuoteLineSource, type QuotePromotion } from "./quote.js";
import { divideRoundHalfUp, lineGrossOf } from "./money-math.js";

const CURRENCY = "BDT" as const;

function line(
  overrides: Partial<QuoteLineSource> &
    Pick<QuoteLineSource, "quantity" | "unitPriceMinor" | "precision">,
): QuoteLineSource {
  return {
    offeringId: newId(),
    variantId: newId(),
    kind: "PRODUCT",
    categoryIds: [],
    taxClassKey: undefined,
    taxRateBasisPoints: 0,
    manualDiscount: undefined,
    ...overrides,
  };
}

function promotion(
  overrides: Partial<QuotePromotion> & Pick<QuotePromotion, "benefit">,
): QuotePromotion {
  return {
    promotionId: newId(),
    status: PROMOTION_STATUS.ACTIVE,
    priority: 0,
    startsAt: undefined,
    endsAt: undefined,
    locationIds: [],
    target: { scope: PROMOTION_TARGET_SCOPE.ALL, ids: [] },
    minQuantity: undefined,
    isStackable: false,
    maxDiscountPerLine: undefined,
    ...overrides,
  };
}

function quote(input: {
  lines: readonly QuoteLineSource[];
  promotions?: readonly QuotePromotion[];
  orderDiscount?: Parameters<typeof computeQuote>[0]["orderDiscount"];
  taxInclusive?: boolean;
  rounding?: Parameters<typeof computeQuote>[0]["rounding"];
  paymentIsCash?: boolean;
  approvalPercentAbove?: number;
  approvalAmountAbove?: number;
  locationId?: string;
  at?: Date;
}) {
  return computeQuote({
    currency: CURRENCY,
    locationId: input.locationId ?? newId(),
    at: input.at ?? new Date("2026-10-19T12:00:00.000Z"),
    lines: input.lines,
    promotions: input.promotions ?? [],
    orderDiscount: input.orderDiscount,
    taxInclusive: input.taxInclusive ?? true,
    rounding: input.rounding ?? "NONE",
    paymentIsCash: input.paymentIsCash ?? false,
    approvalPercentAbove: input.approvalPercentAbove ?? 1000,
    approvalAmountAbove: input.approvalAmountAbove ?? 0,
  });
}

describe("quote math", () => {
  it("prices loose rice 1.25 kg at ৳80/kg as 10000 minor units", () => {
    // KG precision 3: 1.25 kg = 1250; ৳80 = 8000 minor units.
    const result = quote({
      lines: [line({ quantity: 1250, unitPriceMinor: 8000, precision: 3 })],
    });
    expect(result.lines[0]?.lineGross.amount).toBe(10_000);
  });

  it("rounds half up when the quantity and price do not divide evenly", () => {
    // 3 × 100 / 10^1 = 30 exactly; 1 × 1 / 10^1 = 0.1 → 0; 15 × 1 / 10^1 = 1.5 → 2.
    expect(lineGrossOf({ unitPriceMinor: 1, quantity: 15, precision: 1 })).toBe(2);
    expect(divideRoundHalfUp(15n, 10n)).toBe(2n);
    expect(divideRoundHalfUp(14n, 10n)).toBe(1n);
  });

  it("fails a float product that would round differently (integer math guard)", () => {
    // 0.1 + 0.2 style trap: 333 × 3 / 100 with floats is messy; integer half-up is exact.
    const amount = lineGrossOf({ unitPriceMinor: 333, quantity: 3, precision: 2 });
    expect(amount).toBe(10); // 999/100 = 9.99 → 10
    expect((333 * 3) / 100).not.toBe(amount); // float path differs
  });

  it("uses the branch override unit price", () => {
    const result = quote({
      lines: [line({ quantity: 1, unitPriceMinor: 12_000, precision: 0 })],
    });
    expect(result.lines[0]?.unitPrice.amount).toBe(12_000);
    expect(result.lines[0]?.lineGross.amount).toBe(12_000);
  });

  it("includes modifier deltas already folded into unitPriceMinor", () => {
    const result = quote({
      lines: [line({ quantity: 2, unitPriceMinor: 5500, precision: 0 })],
    });
    expect(result.lines[0]?.lineGross.amount).toBe(11_000);
  });

  it("splits inclusive 7.5% tax from ৳107.50 as ৳7.50", () => {
    const result = quote({
      taxInclusive: true,
      lines: [
        line({
          quantity: 1,
          unitPriceMinor: 10_750,
          precision: 0,
          taxClassKey: "vat",
          taxRateBasisPoints: 750,
        }),
      ],
    });
    expect(result.lines[0]?.lineTax.amount).toBe(750);
    expect(result.lines[0]?.lineNetTotal.amount).toBe(10_750);
  });

  it("adds exclusive tax on top of the net", () => {
    const result = quote({
      taxInclusive: false,
      lines: [
        line({
          quantity: 1,
          unitPriceMinor: 10_000,
          precision: 0,
          taxRateBasisPoints: 750,
        }),
      ],
    });
    expect(result.lines[0]?.lineTax.amount).toBe(750);
    expect(result.lines[0]?.lineNetTotal.amount).toBe(10_750);
  });

  it("allocates an order discount by largest remainder across three uneven lines", () => {
    const result = quote({
      lines: [
        line({ quantity: 1, unitPriceMinor: 100, precision: 0 }),
        line({ quantity: 1, unitPriceMinor: 100, precision: 0 }),
        line({ quantity: 1, unitPriceMinor: 100, precision: 0 }),
      ],
      orderDiscount: { type: "AMOUNT", value: 100 },
    });
    const parts = result.lines.map((row) => row.lineDiscount.amount);
    expect(parts.reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(new Set(parts).size).toBeGreaterThan(1); // not all equal after remainder
    // Equal weights → 34, 33, 33 (largest remainder).
    expect(parts.sort((a, b) => b - a)).toEqual([34, 33, 33]);
  });

  it("re-allocates order-discount leftover when one line has little room left", () => {
    // Line A is almost fully discounted (room 100); line B has full room (1000).
    // Order discount 500 would give 250 each by gross, but A can only take 100 — the other
    // 150 must move to B so the customer still gets the full 500.
    const result = quote({
      lines: [
        line({
          quantity: 1,
          unitPriceMinor: 1000,
          precision: 0,
          manualDiscount: { type: "AMOUNT", value: 900 },
        }),
        line({ quantity: 1, unitPriceMinor: 1000, precision: 0 }),
      ],
      orderDiscount: { type: "AMOUNT", value: 500 },
    });
    const orderParts = result.lines.map(
      (row) => row.lineDiscount.amount - row.manualDiscount.amount - row.promotionDiscount.amount,
    );
    expect(orderParts.reduce((sum, value) => sum + value, 0)).toBe(500);
    expect(orderParts[0]).toBe(100);
    expect(orderParts[1]).toBe(400);
  });

  it("never drops a line below zero", () => {
    const result = quote({
      lines: [
        line({
          quantity: 1,
          unitPriceMinor: 1000,
          precision: 0,
          manualDiscount: { type: "AMOUNT", value: 5000 },
        }),
      ],
      promotions: [
        promotion({
          benefit: { type: PROMOTION_BENEFIT_TYPE.PERCENT, value: 10_000 },
        }),
      ],
    });
    expect(result.lines[0]?.lineNetTotal.amount).toBe(0);
    expect(result.lines[0]?.lineDiscount.amount).toBe(1000);
  });

  it("never raises a price with FIXED_PRICE", () => {
    const result = quote({
      lines: [line({ quantity: 1, unitPriceMinor: 1000, precision: 0 })],
      promotions: [
        promotion({
          benefit: {
            type: PROMOTION_BENEFIT_TYPE.FIXED_PRICE,
            value: { amount: 1500, currency: CURRENCY },
          },
        }),
      ],
    });
    expect(result.lines[0]?.promotionDiscount.amount).toBe(0);
    expect(result.lines[0]?.lineNetTotal.amount).toBe(1000);
  });

  it("applies cash rounding to 5 taka with the adjustment", () => {
    const result = quote({
      paymentIsCash: true,
      rounding: "NEAREST_5",
      lines: [line({ quantity: 1, unitPriceMinor: 10_300, precision: 0 })],
    });
    expect(result.totals.grandTotal.amount).toBe(10_500);
    expect(result.totals.roundingAdjustment.amount).toBe(200);
  });
});

describe("promotions", () => {
  it("picks the best discount and breaks ties by priority", () => {
    const lowPriority = promotion({
      priority: 1,
      benefit: { type: PROMOTION_BENEFIT_TYPE.PERCENT, value: 2000 },
    });
    const highPriority = promotion({
      priority: 10,
      benefit: { type: PROMOTION_BENEFIT_TYPE.PERCENT, value: 2000 },
    });
    const result = quote({
      lines: [line({ quantity: 1, unitPriceMinor: 10_000, precision: 0 })],
      promotions: [lowPriority, highPriority],
    });
    expect(result.lines[0]?.promotionIds).toEqual([highPriority.promotionId]);
    expect(result.lines[0]?.promotionDiscount.amount).toBe(2000);
  });

  it("adds stackable promotions", () => {
    const result = quote({
      lines: [line({ quantity: 1, unitPriceMinor: 10_000, precision: 0 })],
      promotions: [
        promotion({
          isStackable: true,
          benefit: { type: PROMOTION_BENEFIT_TYPE.PERCENT, value: 1000 },
        }),
        promotion({
          isStackable: true,
          benefit: {
            type: PROMOTION_BENEFIT_TYPE.AMOUNT_OFF,
            value: { amount: 500, currency: CURRENCY },
          },
        }),
      ],
    });
    expect(result.lines[0]?.promotionDiscount.amount).toBe(1500);
    expect(result.lines[0]?.promotionIds).toHaveLength(2);
  });

  it("caps each promotion with maxDiscountPerLine", () => {
    const result = quote({
      lines: [line({ quantity: 1, unitPriceMinor: 10_000, precision: 0 })],
      promotions: [
        promotion({
          maxDiscountPerLine: { amount: 300, currency: CURRENCY },
          benefit: { type: PROMOTION_BENEFIT_TYPE.PERCENT, value: 5000 },
        }),
      ],
    });
    expect(result.lines[0]?.promotionDiscount.amount).toBe(300);
  });

  it("ignores DRAFT, out-of-time and wrong-branch promotions", () => {
    const locationId = newId();
    const at = new Date("2026-10-19T12:00:00.000Z");
    const result = quote({
      locationId,
      at,
      lines: [line({ quantity: 1, unitPriceMinor: 10_000, precision: 0 })],
      promotions: [
        promotion({
          status: PROMOTION_STATUS.DRAFT,
          benefit: { type: PROMOTION_BENEFIT_TYPE.PERCENT, value: 5000 },
        }),
        promotion({
          startsAt: new Date("2026-10-20T00:00:00.000Z"),
          benefit: { type: PROMOTION_BENEFIT_TYPE.PERCENT, value: 5000 },
        }),
        promotion({
          locationIds: [newId()],
          benefit: { type: PROMOTION_BENEFIT_TYPE.PERCENT, value: 5000 },
        }),
      ],
    });
    expect(result.lines[0]?.promotionDiscount.amount).toBe(0);
  });

  it("honours minQuantity in unit precision", () => {
    const result = quote({
      lines: [line({ quantity: 2, unitPriceMinor: 1000, precision: 0 })],
      promotions: [
        promotion({
          minQuantity: 3,
          benefit: { type: PROMOTION_BENEFIT_TYPE.PERCENT, value: 1000 },
        }),
      ],
    });
    expect(result.lines[0]?.promotionDiscount.amount).toBe(0);
  });
});

describe("approval flags", () => {
  it("flags an 11% manual discount when the threshold is 10%", () => {
    const result = quote({
      approvalPercentAbove: 1000,
      lines: [
        line({
          quantity: 1,
          unitPriceMinor: 10_000,
          precision: 0,
          manualDiscount: { type: "PERCENT", value: 1100 },
        }),
      ],
    });
    expect(result.approvalsRequired).toEqual([{ action: "DISCOUNT", lineIndex: 0 }]);
  });

  it("flags when the amount threshold is crossed and ignores amount when it is 0", () => {
    const overAmount = quote({
      approvalAmountAbove: 500,
      lines: [
        line({
          quantity: 1,
          unitPriceMinor: 10_000,
          precision: 0,
          manualDiscount: { type: "AMOUNT", value: 600 },
        }),
      ],
    });
    const amountOff = quote({
      approvalAmountAbove: 0,
      approvalPercentAbove: 10_000,
      lines: [
        line({
          quantity: 1,
          unitPriceMinor: 10_000,
          precision: 0,
          manualDiscount: { type: "AMOUNT", value: 600 },
        }),
      ],
    });
    expect(overAmount.approvalsRequired).toEqual([{ action: "DISCOUNT", lineIndex: 0 }]);
    expect(amountOff.approvalsRequired).toEqual([]);
  });
});
