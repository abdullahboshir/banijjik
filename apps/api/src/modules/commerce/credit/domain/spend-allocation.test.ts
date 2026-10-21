import { describe, expect, it } from "vitest";
import { allocateSpend, type PurchaseForAllocation } from "./spend-allocation.js";

const AS_OF = "2026-10-21";

function purchase(
  input: Partial<PurchaseForAllocation> & Pick<PurchaseForAllocation, "purchaseEntryId">,
): PurchaseForAllocation {
  return {
    credits: 10,
    spent: 0,
    occurredAt: "2026-10-01T00:00:00.000Z",
    expiresOn: null,
    ...input,
  };
}

describe("allocateSpend", () => {
  it("takes the oldest purchase first and leaves the newest untouched", () => {
    const allocations = allocateSpend({
      cost: 4,
      asOf: AS_OF,
      purchases: [
        purchase({ purchaseEntryId: "newer", occurredAt: "2026-10-05T00:00:00.000Z" }),
        purchase({ purchaseEntryId: "older", occurredAt: "2026-10-01T00:00:00.000Z" }),
      ],
    });

    expect(allocations).toEqual([{ purchaseEntryId: "older", credits: 4 }]);
  });

  it("spends unexpired purchases before expired ones even when the expired is older", () => {
    const allocations = allocateSpend({
      cost: 5,
      asOf: AS_OF,
      purchases: [
        purchase({
          purchaseEntryId: "expired",
          occurredAt: "2026-09-01T00:00:00.000Z",
          expiresOn: "2026-09-30",
        }),
        purchase({ purchaseEntryId: "live", occurredAt: "2026-10-10T00:00:00.000Z" }),
      ],
    });

    expect(allocations).toEqual([{ purchaseEntryId: "live", credits: 5 }]);
  });

  it("moves to the expired purchase when the unexpired one is used up", () => {
    const allocations = allocateSpend({
      cost: 12,
      asOf: AS_OF,
      purchases: [
        purchase({
          purchaseEntryId: "expired",
          occurredAt: "2026-09-01T00:00:00.000Z",
          expiresOn: "2026-09-30",
        }),
        purchase({
          purchaseEntryId: "live",
          credits: 3,
          occurredAt: "2026-10-10T00:00:00.000Z",
        }),
      ],
    });

    expect(allocations).toEqual([
      { purchaseEntryId: "live", credits: 3 },
      { purchaseEntryId: "expired", credits: 9 },
    ]);
  });

  it("ignores purchases that are fully spent", () => {
    const allocations = allocateSpend({
      cost: 2,
      asOf: AS_OF,
      purchases: [
        purchase({ purchaseEntryId: "spent", credits: 10, spent: 10 }),
        purchase({ purchaseEntryId: "open", credits: 5 }),
      ],
    });

    expect(allocations).toEqual([{ purchaseEntryId: "open", credits: 2 }]);
  });

  it("attributes what no purchase covers as non-expiring credit", () => {
    const allocations = allocateSpend({
      cost: 8,
      asOf: AS_OF,
      purchases: [purchase({ purchaseEntryId: "small", credits: 3 })],
    });

    expect(allocations).toEqual([
      { purchaseEntryId: "small", credits: 3 },
      { purchaseEntryId: null, credits: 5 },
    ]);
  });

  it("does not add an unattributed row when the purchases cover the cost exactly", () => {
    const allocations = allocateSpend({
      cost: 3,
      asOf: AS_OF,
      purchases: [purchase({ purchaseEntryId: "exact", credits: 3 })],
    });

    expect(allocations).toEqual([{ purchaseEntryId: "exact", credits: 3 }]);
  });

  it("returns no allocations for a zero cost", () => {
    expect(
      allocateSpend({
        cost: 0,
        asOf: AS_OF,
        purchases: [purchase({ purchaseEntryId: "any" })],
      }),
    ).toEqual([]);
  });
});
