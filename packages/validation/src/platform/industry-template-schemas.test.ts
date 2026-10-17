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
});

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
