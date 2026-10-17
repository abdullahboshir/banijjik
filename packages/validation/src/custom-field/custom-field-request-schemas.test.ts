import { describe, expect, it } from "vitest";
import {
  customFieldDefinitionCreateRequestSchema,
  customFieldDefinitionUpdateRequestSchema,
} from "./custom-field-request-schemas.js";

function aCreateRequest(overrides: object = {}): object {
  return {
    entityType: "contact",
    fieldKey: "school_name",
    label: { bn: "স্কুল", en: "School" },
    fieldType: "TEXT",
    isRequired: false,
    visibility: { admin: true, storefront: false, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: 1,
    ...overrides,
  };
}

describe("custom field definition roles", () => {
  it("accepts roles on a contact field", () => {
    const request = aCreateRequest({ appliesToContactRoles: ["CUSTOMER", "RELATED"] });

    expect(customFieldDefinitionCreateRequestSchema.safeParse(request).success).toBe(true);
  });

  it.each([
    ["roles on another entity", { entityType: "member", appliesToContactRoles: ["CUSTOMER"] }],
    ["an empty role list", { appliesToContactRoles: [] }],
    ["a repeated role", { appliesToContactRoles: ["CUSTOMER", "CUSTOMER"] }],
    ["an unknown role", { appliesToContactRoles: ["PATIENT"] }],
  ])("refuses %s", (_label, override) => {
    const result = customFieldDefinitionCreateRequestSchema.safeParse(aCreateRequest(override));

    expect(result.success).toBe(false);
  });

  it("lets an update set the roles or clear them with null", () => {
    const set = customFieldDefinitionUpdateRequestSchema.safeParse({
      version: 1,
      appliesToContactRoles: ["LEAD"],
    });
    const cleared = customFieldDefinitionUpdateRequestSchema.safeParse({
      version: 1,
      appliesToContactRoles: null,
    });

    expect(set.success && cleared.success).toBe(true);
  });
});
