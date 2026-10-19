import { LISTING_STATUS } from "@banijjik/contracts/directory";
import {
  asId,
  newId,
  type CustomerAccountId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { Listing } from "./listing.entity.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function aDraft(): Listing {
  return Listing.create({
    organizationId: asId<OrganizationId>(newId()),
    listingNumber: "L-1",
    ownerCustomerAccountId: asId<CustomerAccountId>(newId()),
    customFields: { age_band: "25" },
    customFieldSearch: [{ fieldKey: "age_band", value: "25" }],
    photoFileIds: [],
    createdByUserId: null,
    now: NOW,
  });
}

describe("Listing status machine", () => {
  it("submits a draft, then approves it", () => {
    const reviewer = asId<UserId>(newId());
    const submitted = aDraft().submit([], NOW, new Set());
    const approved = submitted.approve(NOW, reviewer);

    expect(submitted.status).toBe(LISTING_STATUS.SUBMITTED);
    expect(approved.status).toBe(LISTING_STATUS.APPROVED);
    expect(approved.publishedAt).toEqual(NOW);
    expect(approved.reviewedByUserId).toBe(reviewer);
  });

  it("rejects, allows a fix, and refuses after a final reason", () => {
    const reviewer = asId<UserId>(newId());
    const rejected = aDraft()
      .submit([], NOW, new Set())
      .reject({ reasonKeys: ["false_info"] }, NOW, reviewer);
    const fixed = rejected.withOwnerData(
      {
        customFields: { age_band: "26" },
        customFieldSearch: [{ fieldKey: "age_band", value: "26" }],
        photoFileIds: [],
      },
      NOW,
      { reviewEdits: true, finalReasonKeys: new Set(["fraud"]) },
    );
    const finalRejected = aDraft()
      .submit([], NOW, new Set())
      .reject({ reasonKeys: ["fraud"] }, NOW, reviewer);

    expect(fixed.status).toBe(LISTING_STATUS.REJECTED);
    expect(() =>
      finalRejected.withOwnerData(
        {
          customFields: {},
          customFieldSearch: [],
          photoFileIds: [],
        },
        NOW,
        { reviewEdits: true, finalReasonKeys: new Set(["fraud"]) },
      ),
    ).toThrow(/directory_final_rejection/);
  });

  it("returns an approved listing to submitted when reviewEdits is on", () => {
    const approved = aDraft().submit([], NOW, new Set()).approve(NOW, asId<UserId>(newId()));
    const edited = approved.withOwnerData(
      {
        customFields: { age_band: "30" },
        customFieldSearch: [{ fieldKey: "age_band", value: "30" }],
        photoFileIds: [],
      },
      NOW,
      { reviewEdits: true, finalReasonKeys: new Set() },
    );

    expect(edited.status).toBe(LISTING_STATUS.SUBMITTED);
    expect(edited.publishedAt).toBeUndefined();
  });

  it("hides and unhides an approved listing", () => {
    const actor = asId<UserId>(newId());
    const approved = aDraft().submit([], NOW, new Set()).approve(NOW, actor);
    const hidden = approved.hide(NOW, actor);
    const shown = hidden.unhide(NOW, actor);

    expect(hidden.status).toBe(LISTING_STATUS.HIDDEN);
    expect(shown.status).toBe(LISTING_STATUS.APPROVED);
  });

  it("archives and clears personal data while keeping the listing number", () => {
    const archived = aDraft().archive(NOW);

    expect(archived.status).toBe(LISTING_STATUS.ARCHIVED);
    expect(archived.listingNumber).toBe("L-1");
    expect(archived.customFields).toEqual({});
    expect(archived.photoFileIds).toEqual([]);
  });
});
