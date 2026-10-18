import type { OfferingLocationResponse } from "@banijjik/contracts/catalog";
import { describe, expect, it } from "vitest";
import { branchStateOf, planBranchChanges } from "./branch-changes";

const MEDIUM = "v-medium";
const LARGE = "v-large";

function row(
  variantId: string | null,
  patch: Partial<OfferingLocationResponse> = {},
): OfferingLocationResponse {
  return {
    offeringId: "o-1",
    variantId,
    locationId: "l-2",
    isAvailable: true,
    priceOverride: null,
    ...patch,
  };
}

describe("branchStateOf", () => {
  it("shows the defaults when the branch has no rows", () => {
    expect(branchStateOf([], [MEDIUM])).toEqual({
      isAvailable: true,
      variants: [{ variantId: MEDIUM, isAvailable: true, priceText: "" }],
    });
  });

  it("shows a stored branch price as typed text and a turned-off variant", () => {
    const state = branchStateOf(
      [
        row(MEDIUM, { priceOverride: { amount: 40050, currency: "BDT" } }),
        row(LARGE, { isAvailable: false }),
      ],
      [MEDIUM, LARGE],
    );

    expect(state.variants).toEqual([
      { variantId: MEDIUM, isAvailable: true, priceText: "400.5" },
      { variantId: LARGE, isAvailable: false, priceText: "" },
    ]);
  });
});

describe("planBranchChanges", () => {
  it("sends a price for the second location and nothing for an untouched variant", () => {
    const plan = planBranchChanges({
      state: {
        isAvailable: true,
        variants: [
          { variantId: MEDIUM, isAvailable: true, priceText: "400" },
          { variantId: LARGE, isAvailable: true, priceText: "" },
        ],
      },
      rows: [],
      currency: "BDT",
    });

    expect(plan).toEqual({
      ok: true,
      operations: [
        {
          type: "save",
          variantId: MEDIUM,
          isAvailable: true,
          priceOverride: { amount: 40000, currency: "BDT" },
        },
      ],
    });
  });

  it("clears a row that went back to the defaults and saves a turned-off offering", () => {
    const plan = planBranchChanges({
      state: {
        isAvailable: false,
        variants: [{ variantId: MEDIUM, isAvailable: true, priceText: "" }],
      },
      rows: [row(MEDIUM, { priceOverride: { amount: 1, currency: "BDT" } })],
      currency: "BDT",
    });

    expect(plan).toEqual({
      ok: true,
      operations: [
        { type: "save", isAvailable: false },
        { type: "clear", variantId: MEDIUM },
      ],
    });
  });

  it("names the variant whose price cannot be read and sends nothing", () => {
    const plan = planBranchChanges({
      state: {
        isAvailable: true,
        variants: [{ variantId: LARGE, isAvailable: true, priceText: "x" }],
      },
      rows: [],
      currency: "BDT",
    });

    expect(plan).toEqual({ ok: false, invalidVariantIds: [LARGE] });
  });
});
