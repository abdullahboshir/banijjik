import { describe, expect, it } from "vitest";
import { industryTemplateConfigurationSchema } from "./industry-template-schemas.js";

const TERM = { bn: "গ্রাহক", en: "Customer" };

function aConfiguration(): Record<string, unknown> {
  return {
    contactRoleKeys: ["CUSTOMER"],
    relationKeys: ["GUARDIAN_OF"],
    resourceTypes: [{ resourceTypeKey: "CHAIR", termKey: "resource.CHAIR", isMember: false }],
    terms: { contact: TERM, "resource.CHAIR": { bn: "চেয়ার", en: "Chair" } },
    customFields: [
      {
        entityType: "contact",
        fieldKey: "allergies",
        fieldType: "LONG_TEXT",
        isRequired: false,
        botAsk: false,
        visibility: { admin: true, storefront: false, bot: false },
        isSearchable: false,
        isSensitive: true,
      },
    ],
    settingsDefaults: { "sales.returnWindowDays": 7 },
    knowledgeSeed: [{ topicKey: "HOURS", answer: { bn: "খোলার সময়", en: "Opening hours" } }],
    websiteTemplateKeys: ["general-store"],
    botDefaults: { personaKey: "POLITE_SHOPKEEPER", handoffTopics: ["angry customer"] },
  };
}

describe("industryTemplateConfigurationSchema", () => {
  it("accepts a materialized template configuration", () => {
    expect(industryTemplateConfigurationSchema.safeParse(aConfiguration()).success).toBe(true);
  });

  it.each([
    ["a contact role that is not in the list", { contactRoleKeys: ["PATIENT"] }],
    ["a relation key that is not in the list", { relationKeys: ["COUSIN_OF"] }],
    [
      "a field type that is not one of the sixteen",
      { customFields: [changedField({ fieldType: "RICH_TEXT" })] },
    ],
    ["a term key in the wrong format", { terms: { "Contact.Name": TERM } }],
    ["a setting key in the wrong format", { settingsDefaults: { returnWindow: 7 } }],
    [
      "a field key in the wrong format",
      { customFields: [changedField({ fieldKey: "Allergies" })] },
    ],
    ["a select without options", { customFields: [changedField({ fieldType: "SELECT" })] }],
    ["a reference without a target", { customFields: [changedField({ fieldType: "REFERENCE" })] }],
    ["a link on a member reference", { customFields: [memberLinkField()] }],
    ["a contact link on a field of another entity", { customFields: [contactLinkOnOtherEntity()] }],
    [
      "a resource whose term is missing",
      { resourceTypes: [{ resourceTypeKey: "ROOM", termKey: "resource.ROOM", isMember: false }] },
    ],
    [
      "contact roles on a field of another entity",
      {
        customFields: [changedField({ entityType: "member", appliesToContactRoles: ["CUSTOMER"] })],
      },
    ],
    [
      "an empty role list on a field",
      { customFields: [changedField({ appliesToContactRoles: [] })] },
    ],
    [
      "a contact link while RELATED is not a template role",
      { customFields: [guardianLinkField()] },
    ],
    ["a duplicate contact role", { contactRoleKeys: ["CUSTOMER", "CUSTOMER"] }],
    ["an empty contact role list", { contactRoleKeys: [] }],
    ["a modifier whose max is below its min", { modifierGroupsSeed: [brokenModifier()] }],
    ["a website template key with a space", { websiteTemplateKeys: ["general store"] }],
  ])("rejects %s", (_label, override) => {
    const result = industryTemplateConfigurationSchema.safeParse({
      ...aConfiguration(),
      ...override,
    });
    expect(result.success).toBe(false);
  });

  it("accepts roles on a contact field and a contact link when RELATED is a template role", () => {
    const result = industryTemplateConfigurationSchema.safeParse({
      ...aConfiguration(),
      contactRoleKeys: ["CUSTOMER", "RELATED"],
      customFields: [
        changedField({ appliesToContactRoles: ["CUSTOMER"] }),
        { ...guardianLinkField(), fieldKey: "guardian", appliesToContactRoles: ["CUSTOMER"] },
      ],
    });

    expect(result.success).toBe(true);
  });

  // Card M.7 decision 1: templates stored before reportReasons existed must still validate.
  it("accepts a directory block without reportReasons and defaults it to empty", () => {
    const result = industryTemplateConfigurationSchema.safeParse({
      ...aConfiguration(),
      directory: aDirectoryBlock({}),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const parsed = result.data as { directory: { reportReasons: unknown[] } };
      expect(parsed.directory.reportReasons).toEqual([]);
    }
  });

  it("accepts reportReasons with unique keys", () => {
    const result = industryTemplateConfigurationSchema.safeParse({
      ...aConfiguration(),
      directory: aDirectoryBlock({
        reportReasons: [
          { reasonKey: "fake_profile", label: TERM },
          { reasonKey: "already_married", label: TERM },
        ],
      }),
    });

    expect(result.success).toBe(true);
  });

  it("refuses duplicate reportReasons keys", () => {
    const result = industryTemplateConfigurationSchema.safeParse({
      ...aConfiguration(),
      directory: aDirectoryBlock({
        reportReasons: [
          { reasonKey: "fake_profile", label: TERM },
          { reasonKey: "fake_profile", label: TERM },
        ],
      }),
    });

    expect(result.success).toBe(false);
  });

  // Card M.6a decision 4: the home statistics field must be a PUBLIC SELECT listing field.
  it("accepts a home statistics field that is a PUBLIC SELECT listing field", () => {
    const result = industryTemplateConfigurationSchema.safeParse(
      withListingField(listingField({}), { homeStatsFieldKey: "gender" }),
    );

    expect(result.success).toBe(true);
  });

  it.each([
    ["a TEXT field", listingField({ fieldType: "TEXT", options: undefined })],
    ["a MEMBERS tier field", listingField({ listingTier: "MEMBERS" })],
  ])("refuses a home statistics field that is %s", (_label, field) => {
    const result = industryTemplateConfigurationSchema.safeParse(
      withListingField(field, { homeStatsFieldKey: "gender" }),
    );

    expect(result.success).toBe(false);
  });

  it("refuses a home statistics field key that names no listing field", () => {
    const result = industryTemplateConfigurationSchema.safeParse(
      withListingField(listingField({}), { homeStatsFieldKey: "missing_key" }),
    );

    expect(result.success).toBe(false);
  });
});

/** A SELECT listing field, PUBLIC unless the override says otherwise. */
function listingField(override: object): object {
  return {
    entityType: "listing",
    fieldKey: "gender",
    fieldType: "SELECT",
    options: ["MALE", "FEMALE"],
    isRequired: false,
    botAsk: false,
    visibility: { admin: true, storefront: true, bot: false },
    isSearchable: false,
    isSensitive: false,
    listingTier: "PUBLIC",
    ...override,
  };
}

function withListingField(field: object, directoryOverride: object) {
  return {
    ...aConfiguration(),
    customFields: [...(aConfiguration().customFields as object[]), field],
    directory: aDirectoryBlock(directoryOverride),
  };
}

function aDirectoryBlock(override: object): object {
  return {
    sections: [{ sectionKey: "basics", label: TERM }],
    consents: [{ consentKey: "truthful_info", text: TERM }],
    rejectionReasons: [{ reasonKey: "photo_unclear", label: TERM, isFinal: false }],
    listingNumberPrefix: "BIO",
    ...override,
  };
}

function changedField(override: object): object {
  const [field] = aConfiguration().customFields as object[];
  return { ...field, ...override };
}

function memberLinkField(): object {
  return {
    ...changedField({ fieldType: "REFERENCE", referenceEntity: "member" }),
    link: { relationKey: "GUARDIAN_OF", createIfMissingByPhone: true, defaultBillTo: false },
  };
}

/** The reference points at a contact, but the field belongs to a member: only the contact module resolves links. */
function contactLinkOnOtherEntity(): object {
  return {
    ...changedField({ fieldType: "REFERENCE", referenceEntity: "contact", entityType: "member" }),
    link: { relationKey: "GUARDIAN_OF", createIfMissingByPhone: true, defaultBillTo: false },
  };
}

function guardianLinkField(): object {
  return {
    ...changedField({ fieldType: "REFERENCE", referenceEntity: "contact" }),
    link: { relationKey: "GUARDIAN_OF", createIfMissingByPhone: true, defaultBillTo: false },
  };
}

function brokenModifier(): object {
  return {
    name: "Size",
    selection: "SINGLE",
    isRequired: true,
    minSelect: 2,
    maxSelect: 1,
    options: [{ name: "Regular", priceDeltaMinor: 0 }],
  };
}
