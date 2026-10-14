import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildCustomFieldValuesSchema } from "./build-custom-field-values-schema.js";
import { redactSensitive, toSearchEntries } from "./custom-field-helpers.js";
import {
  CUSTOM_FIELD_AUDIENCE,
  CUSTOM_FIELD_VALUE_MODE,
  type CustomFieldRule,
} from "./custom-field-rule.js";

const visibility = { admin: true, storefront: true, bot: true };

function rule(
  overrides: Partial<CustomFieldRule> & Pick<CustomFieldRule, "fieldKey" | "fieldType">,
): CustomFieldRule {
  return {
    isRequired: false,
    visibility,
    isSensitive: false,
    isSearchable: false,
    ...overrides,
  };
}

function parse(
  fields: readonly CustomFieldRule[],
  value: unknown,
  mode: "CREATE" | "UPDATE" = "CREATE",
) {
  const schema = z.strictObject({
    customFields: buildCustomFieldValuesSchema(fields, {
      audience: CUSTOM_FIELD_AUDIENCE.ADMIN,
      mode: mode === "CREATE" ? CUSTOM_FIELD_VALUE_MODE.CREATE : CUSTOM_FIELD_VALUE_MODE.UPDATE,
    }),
  });
  return schema.safeParse({ customFields: value });
}

function issuePaths(result: ReturnType<typeof parse>): string[] {
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join("."));
}

describe("custom field values, per type", () => {
  it("accepts one valid value and refuses two invalid ones for each type", () => {
    const fileId = newId();
    const cases: { field: CustomFieldRule; valid: unknown; invalid: readonly unknown[] }[] = [
      {
        field: rule({ fieldKey: "note", fieldType: CUSTOM_FIELD_TYPE.TEXT }),
        valid: "  hello ",
        invalid: ["", "x".repeat(201)],
      },
      {
        field: rule({ fieldKey: "story", fieldType: CUSTOM_FIELD_TYPE.LONG_TEXT }),
        valid: "a long note",
        invalid: ["", "x".repeat(2001)],
      },
      {
        field: rule({
          fieldKey: "age",
          fieldType: CUSTOM_FIELD_TYPE.NUMBER,
          validation: { min: 0, max: 120 },
        }),
        valid: 30,
        invalid: [30.5, 121],
      },
      {
        field: rule({ fieldKey: "weight", fieldType: CUSTOM_FIELD_TYPE.DECIMAL }),
        valid: "70.5",
        invalid: [70.5, "70.12345"],
      },
      {
        field: rule({
          fieldKey: "fee",
          fieldType: CUSTOM_FIELD_TYPE.CURRENCY,
          validation: { min: 0 },
        }),
        valid: 15000,
        invalid: [15.5, -1],
      },
      {
        field: rule({ fieldKey: "vip", fieldType: CUSTOM_FIELD_TYPE.BOOLEAN }),
        valid: true,
        invalid: ["true", 1],
      },
      {
        field: rule({ fieldKey: "day", fieldType: CUSTOM_FIELD_TYPE.DATE }),
        valid: "2026-02-28",
        invalid: ["2026-02-30", "28-02-2026"],
      },
      {
        field: rule({ fieldKey: "when", fieldType: CUSTOM_FIELD_TYPE.DATETIME }),
        valid: "2026-10-14T16:00:00+06:00",
        invalid: ["2026-10-14T16:00:00", "2026-02-30T00:00:00Z"],
      },
      {
        field: rule({ fieldKey: "size", fieldType: CUSTOM_FIELD_TYPE.SELECT, options: ["S", "M"] }),
        valid: "M",
        invalid: ["L", ""],
      },
      {
        field: rule({
          fieldKey: "tags",
          fieldType: CUSTOM_FIELD_TYPE.MULTI_SELECT,
          options: ["A", "B"],
        }),
        valid: ["A", "B"],
        invalid: [
          ["A", "A"],
          ["A", "C"],
        ],
      },
      {
        field: rule({ fieldKey: "phone", fieldType: CUSTOM_FIELD_TYPE.PHONE }),
        valid: "01712345678",
        invalid: ["123", "not-a-phone"],
      },
      {
        field: rule({ fieldKey: "email", fieldType: CUSTOM_FIELD_TYPE.EMAIL }),
        valid: "Ada@Example.com",
        invalid: ["ada", "ada@"],
      },
      {
        field: rule({ fieldKey: "site", fieldType: CUSTOM_FIELD_TYPE.URL }),
        valid: "https://example.com/a",
        invalid: ["ftp://example.com", "https://example.com/" + "a".repeat(2048)],
      },
      {
        field: rule({ fieldKey: "file", fieldType: CUSTOM_FIELD_TYPE.FILE }),
        valid: fileId,
        invalid: ["not-a-uuid", "550e8400-e29b-41d4-a716-446655440000"],
      },
      {
        field: rule({ fieldKey: "image", fieldType: CUSTOM_FIELD_TYPE.IMAGE }),
        valid: fileId,
        invalid: ["nope", ""],
      },
      {
        field: rule({ fieldKey: "person", fieldType: CUSTOM_FIELD_TYPE.REFERENCE }),
        valid: fileId,
        invalid: ["nope", 12],
      },
    ];

    for (const { field, valid, invalid } of cases) {
      const accepted = parse([field], { [field.fieldKey]: valid });
      expect(accepted.success, field.fieldKey).toBe(true);
      for (const bad of invalid) {
        expect(
          parse([field], { [field.fieldKey]: bad }).success,
          `${field.fieldKey} ${String(bad)}`,
        ).toBe(false);
      }
    }
  });

  it("trims text, normalizes a phone and lower-cases an email", () => {
    const fields = [
      rule({ fieldKey: "note", fieldType: CUSTOM_FIELD_TYPE.TEXT }),
      rule({ fieldKey: "phone", fieldType: CUSTOM_FIELD_TYPE.PHONE }),
      rule({ fieldKey: "email", fieldType: CUSTOM_FIELD_TYPE.EMAIL }),
    ];
    const parsed = parse(fields, {
      note: "  hello ",
      phone: "01712345678",
      email: "Ada@Example.com",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.customFields).toMatchObject({
      note: "hello",
      phone: "+8801712345678",
      email: "ada@example.com",
    });
  });

  it("normalizes a datetime to UTC", () => {
    const parsed = parse([rule({ fieldKey: "when", fieldType: CUSTOM_FIELD_TYPE.DATETIME })], {
      when: "2026-10-14T16:00:00+06:00",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.customFields).toMatchObject({ when: "2026-10-14T10:00:00.000Z" });
  });

  it("requires a field on create, allows it to be absent on update, and refuses null on a required field", () => {
    const field = rule({ fieldKey: "note", fieldType: CUSTOM_FIELD_TYPE.TEXT, isRequired: true });
    expect(parse([field], {}).success).toBe(false);
    expect(parse([field], { note: null }).success).toBe(false);
    expect(parse([field], {}, "UPDATE").success).toBe(true);
    expect(parse([field], { note: null }, "UPDATE").success).toBe(false);
    expect(parse([field], { note: "kept" }, "UPDATE").success).toBe(true);
  });

  it("clears an optional field with null and allows it to be absent", () => {
    const field = rule({ fieldKey: "note", fieldType: CUSTOM_FIELD_TYPE.TEXT });
    expect(parse([field], {}).success).toBe(true);
    expect(parse([field], { note: null }).success).toBe(true);
    expect(parse([field], { note: null }, "UPDATE").success).toBe(true);
  });

  it("refuses an unknown key and a key that the storefront cannot see", () => {
    const fields = [
      rule({ fieldKey: "note", fieldType: CUSTOM_FIELD_TYPE.TEXT }),
      rule({
        fieldKey: "secret",
        fieldType: CUSTOM_FIELD_TYPE.TEXT,
        visibility: { admin: true, storefront: false, bot: false },
      }),
    ];
    const unknown = parse(fields, { note: "ok", extra: "no" });
    expect(unknown.success).toBe(false);
    expect(issuePaths(unknown)).toContain("customFields.extra");

    const storefront = z
      .strictObject({
        customFields: buildCustomFieldValuesSchema(fields, {
          audience: CUSTOM_FIELD_AUDIENCE.STOREFRONT,
          mode: CUSTOM_FIELD_VALUE_MODE.CREATE,
        }),
      })
      .safeParse({ customFields: { note: "ok", secret: "hidden" } });
    expect(storefront.success).toBe(false);
    if (storefront.success) return;
    expect(storefront.error.issues.map((issue) => issue.path.join("."))).toContain(
      "customFields.secret",
    );
  });

  it("refuses inherited keys that are not fields", () => {
    const field = rule({ fieldKey: "note", fieldType: CUSTOM_FIELD_TYPE.TEXT });
    for (const key of ["constructor", "toString", "hasOwnProperty"]) {
      const result = parse([field], { note: "ok", [key]: "x" });
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain(`customFields.${key}`);
    }
    const withProto = JSON.parse('{"note":"ok","__proto__":{"polluted":true}}') as {
      note: string;
    };
    const proto = parse([field], withProto);
    expect(proto.success).toBe(false);
    expect(issuePaths(proto)).toContain("customFields.__proto__");
  });
});

describe("custom field value helpers", () => {
  const fields = [
    rule({ fieldKey: "note", fieldType: CUSTOM_FIELD_TYPE.TEXT, isSearchable: true }),
    rule({
      fieldKey: "secret",
      fieldType: CUSTOM_FIELD_TYPE.TEXT,
      isSensitive: true,
      isSearchable: false,
    }),
    rule({
      fieldKey: "tags",
      fieldType: CUSTOM_FIELD_TYPE.MULTI_SELECT,
      options: ["A"],
      isSearchable: true,
    }),
  ];

  it("drops sensitive values without the permission and keeps them with it", () => {
    const values = { note: "Hi", secret: "private" };
    expect(redactSensitive(values, fields, false)).toEqual({ note: "Hi" });
    expect(redactSensitive(values, fields, true)).toEqual(values);
  });

  it("lower-cases searchable values and skips the rest", () => {
    expect(toSearchEntries({ note: "Hi", secret: "private", tags: ["Ab", "C"] }, fields)).toEqual([
      { fieldKey: "note", value: "hi" },
      { fieldKey: "tags", value: "ab" },
      { fieldKey: "tags", value: "c" },
    ]);
  });
});
