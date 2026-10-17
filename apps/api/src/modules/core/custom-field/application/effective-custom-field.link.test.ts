import type { IndustryTemplateCustomField } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { mergeEffectiveFields } from "./effective-custom-field.js";

const LINK = {
  relationKey: "GUARDIAN_OF",
  createIfMissingByPhone: true,
  defaultBillTo: true,
} as const;

const GUARDIAN: IndustryTemplateCustomField = {
  entityType: "contact",
  fieldKey: "guardian",
  fieldType: "REFERENCE",
  isRequired: true,
  botAsk: false,
  visibility: { admin: true, storefront: false, bot: false },
  isSearchable: false,
  isSensitive: false,
  referenceEntity: "contact",
  link: LINK,
};

describe("mergeEffectiveFields", () => {
  it("keeps the contact link of a template reference field, so contact can resolve it (ADR-073)", () => {
    const [field] = mergeEffectiveFields({
      entityType: "contact",
      offeringKind: undefined,
      industryFields: [GUARDIAN],
      preferences: [],
      definitions: [],
    });

    expect(field?.link).toEqual(LINK);
  });
});
