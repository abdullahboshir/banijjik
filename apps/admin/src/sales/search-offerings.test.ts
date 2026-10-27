import { OFFERING_KIND } from "@banijjik/contracts";
import { OFFERING_STATUS, type OfferingListItem } from "@banijjik/contracts/catalog";
import { describe, expect, it } from "vitest";
import { mergeOfferingSearchByName, offeringSearchKinds } from "./search-offerings";

function item(name: string, kind: OfferingListItem["kind"], offeringId: string): OfferingListItem {
  return {
    offeringId,
    kind,
    name,
    slug: name,
    status: OFFERING_STATUS.ACTIVE,
    firstImageUrl: null,
    priceFrom: { amount: 1000, currency: "BDT" },
    variantCount: 1,
    categoryIds: [],
    updatedAt: "2026-10-26T00:00:00.000Z",
  };
}

describe("admin offering search kinds", () => {
  it("the admin search includes services only in instant-sale mode", () => {
    expect(offeringSearchKinds(false)).toEqual([OFFERING_KIND.PRODUCT]);
    expect(offeringSearchKinds(true)).toEqual([OFFERING_KIND.PRODUCT, OFFERING_KIND.SERVICE]);
  });

  it("merges two kind lists by name without duplicating an offering", () => {
    const shampoo = item("Shampoo", OFFERING_KIND.PRODUCT, "off-p");
    const haircut = item("Haircut", OFFERING_KIND.SERVICE, "off-s");
    const merged = mergeOfferingSearchByName([[shampoo, haircut], [haircut]]);

    expect(merged.map((row) => row.name)).toEqual(["Haircut", "Shampoo"]);
  });
});
