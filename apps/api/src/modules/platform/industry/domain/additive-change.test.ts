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

  it("lists a changed field type, reference target and link", () => {
    const linked = {
      ...SIZE_FIELD,
      referenceEntity: "contact" as const,
      link: {
        relationKey: "GUARDIAN_OF" as const,
        createIfMissingByPhone: false,
        defaultBillTo: false,
      },
    };
    const before = {
      ...BEFORE,
      configuration: configuration({
        relationKeys: ["GUARDIAN_OF"],
        customFields: [linked, NOTE_FIELD],
      }),
    };
    const after = {
      ...before,
      configuration: configuration({
        relationKeys: ["GUARDIAN_OF", "PARENT_OF"],
        customFields: [
          {
            ...linked,
            fieldType: "TEXT" as const,
            referenceEntity: "member" as const,
            options: undefined,
            link: { ...linked.link, relationKey: "PARENT_OF" as const },
          },
          { ...NOTE_FIELD, fieldType: "DECIMAL" as const },
        ],
      }),
    };

    expect(removedByTemplateChange(before, after)).toEqual([
      "fieldType:offering:SERVICE:note",
      "fieldType:offering:SERVICE:size",
      "link:offering:SERVICE:size",
      "option:offering:SERVICE:size:LARGE",
      "option:offering:SERVICE:size:SMALL",
      "referenceEntity:offering:SERVICE:size",
    ]);
  });

  it("keeps a label, an added option, isRequired, visibility and the other flags editable", () => {
    const linked = {
      ...SIZE_FIELD,
      link: {
        relationKey: "GUARDIAN_OF" as const,
        createIfMissingByPhone: false,
        defaultBillTo: false,
      },
    };
    const before = {
      ...BEFORE,
      configuration: configuration({
        relationKeys: ["GUARDIAN_OF"],
        customFields: [linked, NOTE_FIELD],
      }),
    };
    const after = {
      ...before,
      configuration: configuration({
        relationKeys: ["GUARDIAN_OF"],
        customFields: [
          {
            ...linked,
            label: TEXT,
            isRequired: true,
            botAsk: true,
            isSearchable: true,
            isSensitive: true,
            visibility: { admin: false, storefront: true, bot: true },
            options: ["SMALL", "LARGE", "MEDIUM"],
            link: { ...linked.link, createIfMissingByPhone: true, defaultBillTo: true },
          },
          NOTE_FIELD,
        ],
      }),
    };

    expect(removedByTemplateChange(before, after)).toEqual([]);
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

describe("contact roles in a template change (ADR-113)", () => {
  const CONTACT_FIELD = { ...NOTE_FIELD, entityType: "contact", offeringKind: undefined };

  it("treats a new role, a new field role limit and a changed one as additions", () => {
    const before = {
      ...BEFORE,
      configuration: configuration({ customFields: [CONTACT_FIELD] }),
    };
    const withLimit = {
      ...BEFORE,
      configuration: configuration({
        contactRoleKeys: ["CUSTOMER", "SUPPLIER", "RELATED"],
        customFields: [{ ...CONTACT_FIELD, appliesToContactRoles: ["CUSTOMER"] }],
      }),
    };
    const changedLimit = {
      ...withLimit,
      configuration: configuration({
        contactRoleKeys: ["CUSTOMER", "SUPPLIER", "RELATED"],
        customFields: [{ ...CONTACT_FIELD, appliesToContactRoles: ["CUSTOMER", "RELATED"] }],
      }),
    };

    expect(removedByTemplateChange(before, withLimit)).toEqual([]);
    expect(removedByTemplateChange(withLimit, changedLimit)).toEqual([]);
    expect(removedByTemplateChange(withLimit, before)).toEqual(["contactRole:RELATED"]);
  });
});
