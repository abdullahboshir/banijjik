import type { IndustryTemplateConfiguration } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { removedByTemplateChange, removedKindsAndModules } from "./additive-change.js";

const TEXT = { bn: "নাম", en: "Name" };

function configuration(
  overrides: Partial<IndustryTemplateConfiguration> = {},
): IndustryTemplateConfiguration {
  return {
    contactRoleKeys: ["CUSTOMER", "SUPPLIER"],
    relationKeys: ["GUARDIAN_OF"],
    resourceTypes: [{ resourceTypeKey: "CHAIR", termKey: "chair", isMember: false }],
    terms: { customer: TEXT, chair: TEXT },
    customFields: [],
    settingsDefaults: { "booking.slot": 30 },
    knowledgeSeed: [{ topicKey: "HOURS", answer: TEXT }],
    websiteTemplateKeys: ["shop"],
    botDefaults: { personaKey: "SHOP", handoffTopics: ["price"] },
    ...overrides,
  };
}

const SIZE_FIELD = {
  entityType: "offering",
  offeringKind: "SERVICE" as const,
  fieldKey: "size",
  fieldType: "SELECT" as const,
  isRequired: false,
  botAsk: false,
  visibility: { admin: true, storefront: false, bot: false },
  isSearchable: false,
  isSensitive: false,
  options: ["SMALL", "LARGE"],
};

const NOTE_FIELD = {
  ...SIZE_FIELD,
  fieldKey: "note",
  fieldType: "TEXT" as const,
};

const BEFORE = {
  enabledKinds: ["PRODUCT", "SERVICE"],
  allowedModuleKeys: ["catalog", "booking"],
  configuration: configuration({
    relationKeys: ["GUARDIAN_OF"],
    customFields: [SIZE_FIELD, NOTE_FIELD],
  }),
};

describe("removedByTemplateChange", () => {
  it("lists every removed kind, module, field, key and select option", () => {
    const after = {
      enabledKinds: ["PRODUCT"],
      allowedModuleKeys: ["catalog"],
      configuration: configuration({
        contactRoleKeys: ["CUSTOMER"],
        relationKeys: [],
        resourceTypes: [],
        terms: { customer: TEXT },
        customFields: [{ ...SIZE_FIELD, options: ["SMALL"], label: TEXT }],
        settingsDefaults: { "booking.slot": 45 },
        knowledgeSeed: [{ topicKey: "HOURS", answer: { bn: "নতুন", en: "New" } }],
      }),
    };

    expect(removedByTemplateChange(BEFORE, after)).toEqual([
      "contactRole:SUPPLIER",
      "customField:offering:SERVICE:note",
      "kind:SERVICE",
      "module:booking",
      "option:offering:SERVICE:size:LARGE",
      "relation:GUARDIAN_OF",
      "resourceType:CHAIR",
      "term:chair",
    ]);
  });

  it("allows an added kind, module, field and select option", () => {
    const after = {
      enabledKinds: ["PRODUCT", "SERVICE", "EVENT"],
      allowedModuleKeys: ["catalog", "booking", "enrollment"],
      configuration: configuration({
        relationKeys: ["GUARDIAN_OF"],
        customFields: [{ ...SIZE_FIELD, options: ["SMALL", "LARGE", "MEDIUM"] }, NOTE_FIELD],
        terms: { ...BEFORE.configuration.terms, event: TEXT },
      }),
    };

    expect(removedByTemplateChange(BEFORE, after)).toEqual([]);
  });
});

describe("removedKindsAndModules", () => {
  it("lists a kind or a module the target does not keep", () => {
    expect(
      removedKindsAndModules(
        { enabledKinds: ["PRODUCT", "SERVICE"], allowedModuleKeys: ["catalog", "booking"] },
        { enabledKinds: ["PRODUCT"], allowedModuleKeys: ["catalog"] },
      ),
    ).toEqual(["kind:SERVICE", "module:booking"]);
  });
});
