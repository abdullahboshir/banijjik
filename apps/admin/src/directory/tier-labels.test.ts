import { LISTING_FIELD_TIER } from "@banijjik/contracts/directory";
import { describe, expect, it } from "vitest";
import { listingTierLabelOf } from "./tier-labels";

describe("listingTierLabelOf", () => {
  const t = (key: string) => key;

  it("labels each tier and defaults missing to PUBLIC", () => {
    expect(listingTierLabelOf(LISTING_FIELD_TIER.PRIVATE, t)).toBe("directory.tier.PRIVATE");
    expect(listingTierLabelOf(LISTING_FIELD_TIER.UNLOCKED, t)).toBe("directory.tier.UNLOCKED");
    expect(listingTierLabelOf(LISTING_FIELD_TIER.MEMBERS, t)).toBe("directory.tier.MEMBERS");
    expect(listingTierLabelOf(undefined, t)).toBe("directory.tier.PUBLIC");
  });
});
