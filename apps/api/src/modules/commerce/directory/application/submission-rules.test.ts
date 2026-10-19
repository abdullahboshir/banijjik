import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import { LISTING_FIELD_TIER } from "@banijjik/contracts/directory";
import type { CustomFieldRule } from "@banijjik/validation";
import { describe, expect, it } from "vitest";
import { assertSubmissionRules } from "./submission-rules.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const VISIBILITY = { admin: true, storefront: true, bot: false } as const;

function dateField(minAgeYears: number): CustomFieldRule {
  return {
    fieldKey: "date_of_birth",
    fieldType: CUSTOM_FIELD_TYPE.DATE,
    isRequired: true,
    visibility: VISIBILITY,
    isSensitive: false,
    isSearchable: false,
    isFilterable: true,
    listingTier: LISTING_FIELD_TIER.PUBLIC,
    minAgeYears,
  };
}

function phoneField(): CustomFieldRule {
  return {
    fieldKey: "guardian_phone",
    fieldType: CUSTOM_FIELD_TYPE.PHONE,
    isRequired: true,
    visibility: VISIBILITY,
    isSensitive: false,
    isSearchable: false,
    listingTier: LISTING_FIELD_TIER.UNLOCKED,
    mustDifferFromAccountPhone: true,
  };
}

describe("assertSubmissionRules", () => {
  it("refuses a date of birth under the minimum age on today's edge", () => {
    expect(() =>
      assertSubmissionRules({
        customFields: { date_of_birth: "2008-06-16" },
        fields: [dateField(18)],
        accountPhoneE164: "+8801711000000",
        consents: [],
        directory: undefined,
        now: NOW,
      }),
    ).toThrow(/directory_under_min_age/);
  });

  it("accepts a date of birth that reaches the minimum age today", () => {
    const consents = assertSubmissionRules({
      customFields: { date_of_birth: "2008-06-15" },
      fields: [dateField(18)],
      accountPhoneE164: "+8801711000000",
      consents: [],
      directory: undefined,
      now: NOW,
    });
    expect(consents).toEqual([]);
  });

  it("refuses a guardian phone that matches the account phone", () => {
    expect(() =>
      assertSubmissionRules({
        customFields: { guardian_phone: "+8801711000000" },
        fields: [phoneField()],
        accountPhoneE164: "+8801711000000",
        consents: [],
        directory: undefined,
        now: NOW,
      }),
    ).toThrow(/directory_phone_must_differ/);
  });

  it("requires every template consent", () => {
    expect(() =>
      assertSubmissionRules({
        customFields: {},
        fields: [],
        accountPhoneE164: undefined,
        consents: [],
        directory: {
          sections: [],
          consents: [
            {
              consentKey: "truthful",
              text: { bn: "সত্য", en: "True" },
            },
          ],
          rejectionReasons: [],
          listingNumberPrefix: "BD",
        },
        now: NOW,
      }),
    ).toThrow(/directory_consent_required/);
  });
});
