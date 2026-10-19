import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import {
  LISTING_FIELD_TIER,
  LISTING_VIEWER,
  DIRECTORY_PHOTO_POLICY,
} from "@banijjik/contracts/directory";
import type { CustomFieldRule } from "@banijjik/validation";
import { describe, expect, it } from "vitest";
import { projectListingFields, projectListingPhotos } from "./project-listing.js";

function field(
  fieldKey: string,
  listingTier: (typeof LISTING_FIELD_TIER)[keyof typeof LISTING_FIELD_TIER],
): CustomFieldRule {
  return {
    fieldKey,
    fieldType: CUSTOM_FIELD_TYPE.TEXT,
    isRequired: false,
    visibility: { admin: true, storefront: true, bot: false },
    isSensitive: false,
    isSearchable: false,
    listingTier,
  };
}

const fields = [
  field("age", LISTING_FIELD_TIER.PUBLIC),
  field("family", LISTING_FIELD_TIER.MEMBERS),
  field("guardianPhone", LISTING_FIELD_TIER.UNLOCKED),
  field("ownName", LISTING_FIELD_TIER.PRIVATE),
];

const values = {
  age: "25",
  family: "joint",
  guardianPhone: "+8801712345678",
  ownName: "secret",
};

describe("projectListingFields", () => {
  it("gives PUBLIC only to an anonymous viewer", () => {
    expect(projectListingFields(values, fields, LISTING_VIEWER.PUBLIC)).toEqual({ age: "25" });
  });

  it("adds MEMBERS for a signed-in customer", () => {
    expect(projectListingFields(values, fields, LISTING_VIEWER.MEMBER)).toEqual({
      age: "25",
      family: "joint",
    });
  });

  it("adds UNLOCKED only for an unlocked member (M.4)", () => {
    expect(projectListingFields(values, fields, LISTING_VIEWER.UNLOCKED_MEMBER)).toEqual({
      age: "25",
      family: "joint",
      guardianPhone: "+8801712345678",
    });
  });

  it("never sends PRIVATE to customers", () => {
    for (const viewer of [
      LISTING_VIEWER.PUBLIC,
      LISTING_VIEWER.MEMBER,
      LISTING_VIEWER.UNLOCKED_MEMBER,
    ] as const) {
      expect(projectListingFields(values, fields, viewer)).not.toHaveProperty("ownName");
    }
  });

  it("lets OWNER and STAFF see every tier", () => {
    for (const viewer of [LISTING_VIEWER.OWNER, LISTING_VIEWER.STAFF] as const) {
      expect(projectListingFields(values, fields, viewer)).toEqual(values);
    }
  });
});

describe("projectListingPhotos", () => {
  const ids = ["f1", "f2"];

  it("refuses every photo when the policy is NONE", () => {
    expect(
      projectListingPhotos({
        photoFileIds: ids,
        photoPolicy: DIRECTORY_PHOTO_POLICY.NONE,
        viewer: LISTING_VIEWER.STAFF,
      }),
    ).toEqual([]);
  });

  it("returns ids for BLURRED_PUBLIC to the public (blurred variant served elsewhere)", () => {
    expect(
      projectListingPhotos({
        photoFileIds: ids,
        photoPolicy: DIRECTORY_PHOTO_POLICY.BLURRED_PUBLIC,
        viewer: LISTING_VIEWER.PUBLIC,
      }),
    ).toEqual(ids);
  });

  it("hides UNLOCKED_ONLY photos from the public", () => {
    expect(
      projectListingPhotos({
        photoFileIds: ids,
        photoPolicy: DIRECTORY_PHOTO_POLICY.UNLOCKED_ONLY,
        viewer: LISTING_VIEWER.PUBLIC,
      }),
    ).toEqual([]);
  });
});
