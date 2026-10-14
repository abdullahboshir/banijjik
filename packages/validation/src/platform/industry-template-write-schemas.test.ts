import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  changeIndustryTemplateRequestSchema,
  industryTemplateCreateRequestSchema,
  industryTemplateStatusRequestSchema,
  industryTemplateUpdateRequestSchema,
} from "./industry-template-write-schemas.js";

const TEXT = { bn: "নাম", en: "Name" };

const CONFIGURATION = {
  contactRoleKeys: ["CUSTOMER"],
  relationKeys: [],
  resourceTypes: [],
  terms: { customer: TEXT },
  customFields: [],
  settingsDefaults: {},
  knowledgeSeed: [{ topicKey: "HOURS", answer: TEXT }],
  websiteTemplateKeys: ["shop"],
  botDefaults: { personaKey: "SHOP", handoffTopics: ["price"] },
};

const CREATE = {
  industryTemplateKey: "PHARMACY",
  name: TEXT,
  description: TEXT,
  iconKey: "pill",
  reason: "launch",
  enabledKinds: ["PRODUCT"],
  allowedModuleKeys: ["catalog"],
  configuration: CONFIGURATION,
};

describe("industry template write schemas", () => {
  it("accepts a new template and a clone, and refuses a mix or a gap", () => {
    expect(industryTemplateCreateRequestSchema.safeParse(CREATE).success).toBe(true);
    const clone = {
      industryTemplateKey: "PHARMACY",
      name: TEXT,
      description: TEXT,
      iconKey: "pill",
      reason: "launch",
      cloneFromIndustryTemplateId: newId(),
    };
    expect(industryTemplateCreateRequestSchema.safeParse(clone).success).toBe(true);
    expect(
      industryTemplateCreateRequestSchema.safeParse({
        ...CREATE,
        cloneFromIndustryTemplateId: newId(),
      }).success,
    ).toBe(false);
    const { enabledKinds, ...withoutKinds } = CREATE;
    expect(enabledKinds).toHaveLength(1);
    expect(industryTemplateCreateRequestSchema.safeParse(withoutKinds).success).toBe(false);
  });

  it("refuses a key that is not the template format and an empty reason", () => {
    expect(
      industryTemplateCreateRequestSchema.safeParse({ ...CREATE, industryTemplateKey: "pharmacy" })
        .success,
    ).toBe(false);
    expect(industryTemplateCreateRequestSchema.safeParse({ ...CREATE, reason: " " }).success).toBe(
      false,
    );
  });

  it("requires a version and a reason to edit or to change status", () => {
    expect(
      industryTemplateUpdateRequestSchema.safeParse({ version: 1, reason: "rename", name: TEXT })
        .success,
    ).toBe(true);
    expect(industryTemplateUpdateRequestSchema.safeParse({ reason: "rename" }).success).toBe(false);
    expect(
      industryTemplateStatusRequestSchema.safeParse({ version: 2, reason: "go" }).success,
    ).toBe(true);
    expect(
      industryTemplateStatusRequestSchema.safeParse({ version: 0, reason: "go" }).success,
    ).toBe(false);
  });

  it("requires a template key and a reason to move an organization", () => {
    expect(
      changeIndustryTemplateRequestSchema.safeParse({
        industryTemplateKey: "SALON",
        reason: "pilot",
      }).success,
    ).toBe(true);
    expect(changeIndustryTemplateRequestSchema.safeParse({ reason: "pilot" }).success).toBe(false);
  });
});
