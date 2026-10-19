import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import { LISTING_FIELD_TIER } from "@banijjik/contracts/directory";
import type { CustomFieldRule } from "@banijjik/validation";
import { describe, expect, it } from "vitest";
import { listingFiltersFromQuery } from "./listing-filters.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const VISIBILITY = { admin: true, storefront: true, bot: false } as const;

function field(input: Partial<CustomFieldRule> & { readonly fieldKey: string }): CustomFieldRule {
  return {
    fieldKey: input.fieldKey,
    fieldType: input.fieldType ?? CUSTOM_FIELD_TYPE.SELECT,
    isRequired: false,
    visibility: VISIBILITY,
    isSensitive: false,
    isSearchable: false,
    isFilterable: input.isFilterable ?? true,
    listingTier: LISTING_FIELD_TIER.PUBLIC,
    ...input,
  };
}

describe("listingFiltersFromQuery", () => {
  it("builds an age range from date of birth into date bounds", () => {
    const filters = listingFiltersFromQuery(
      { "f.date_of_birth.ageMin": 20, "f.date_of_birth.ageMax": 30 },
      [field({ fieldKey: "date_of_birth", fieldType: CUSTOM_FIELD_TYPE.DATE })],
      NOW,
    );
    // ageMax 30 → born on or after 1996-06-15; ageMin 20 → born on or before 2006-06-15
    expect(filters).toEqual([
      {
        fieldKey: "date_of_birth",
        value: "",
        minValue: "1996-06-15",
        maxValue: "2006-06-15",
      },
    ]);
  });

  it("builds GEO_BD filters for division, district and upazila", () => {
    const fields = [field({ fieldKey: "home", fieldType: CUSTOM_FIELD_TYPE.GEO_BD })];
    expect(listingFiltersFromQuery({ "f.home.divisionKey": "dhaka" }, fields, NOW)).toEqual([
      { fieldKey: "home", value: "dhaka" },
    ]);
    expect(
      listingFiltersFromQuery(
        { "f.home.divisionKey": "dhaka", "f.home.districtKey": "dhaka" },
        fields,
        NOW,
      ),
    ).toEqual([{ fieldKey: "home", value: "dhaka/dhaka" }]);
    expect(
      listingFiltersFromQuery(
        {
          "f.home.divisionKey": "dhaka",
          "f.home.districtKey": "dhaka",
          "f.home.upazilaKey": "dhanmondi",
        },
        fields,
        NOW,
      ),
    ).toEqual([{ fieldKey: "home", value: "dhaka/dhaka/dhanmondi" }]);
  });

  it("builds MULTI_SELECT any-of filters", () => {
    expect(
      listingFiltersFromQuery(
        { "f.skills": ["Cooking", "Teaching"] },
        [field({ fieldKey: "skills", fieldType: CUSTOM_FIELD_TYPE.MULTI_SELECT })],
        NOW,
      ),
    ).toEqual([{ fieldKey: "skills", value: "", anyOf: ["cooking", "teaching"] }]);
  });

  it("refuses an unknown or non-filterable field", () => {
    expect(() => listingFiltersFromQuery({ "f.unknown": "x" }, [], NOW)).toThrow(
      /directory_filter_not_allowed/,
    );
    expect(() =>
      listingFiltersFromQuery(
        { "f.secret": "x" },
        [field({ fieldKey: "secret", isFilterable: false })],
        NOW,
      ),
    ).toThrow(/directory_filter_not_allowed/);
  });
});
