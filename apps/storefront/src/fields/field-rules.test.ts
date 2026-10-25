import type { StorefrontListingField } from "@banijjik/contracts/directory";
import { describe, expect, it } from "vitest";
import { customFieldsPayload, payloadValueOf } from "./field-payload";
import { fieldKindOf } from "./field-kind";
import { districtOptions, divisionOptions } from "./geo-bd-options";
import { fieldsOfSection, missingRequiredKeys, stepIndexOfPath } from "./field-rules";

function fieldOf(
  overrides: Partial<StorefrontListingField> & { fieldKey: string },
): StorefrontListingField {
  return {
    label: { bn: "লেবেল", en: "Label" },
    fieldType: "TEXT",
    isRequired: false,
    sortOrder: 0,
    ...overrides,
  } as StorefrontListingField;
}

describe("field kinds", () => {
  it("draws every type the form read can return as its own kind", () => {
    const expected: Record<string, string> = {
      TEXT: "text",
      LONG_TEXT: "longText",
      NUMBER: "number",
      DECIMAL: "decimal",
      BOOLEAN: "boolean",
      DATE: "date",
      SELECT: "select",
      MULTI_SELECT: "multiSelect",
      PHONE: "phone",
      EMAIL: "email",
      URL: "url",
      GEO_BD: "geo",
    };
    for (const [fieldType, kind] of Object.entries(expected)) {
      expect(fieldKindOf(fieldType as never)).toBe(kind);
    }
  });
});

describe("required check per step", () => {
  it("reports the required fields of a step that have no answer", () => {
    const fields = [
      fieldOf({ fieldKey: "age", isRequired: true }),
      fieldOf({ fieldKey: "note" }),
      fieldOf({ fieldKey: "district", isRequired: true, fieldType: "GEO_BD" }),
    ];
    expect(missingRequiredKeys(fields, { age: "", district: { divisionKey: "dhaka" } })).toEqual([
      "age",
      "district",
    ]);
    expect(
      missingRequiredKeys(fields, {
        age: "25",
        district: { divisionKey: "dhaka", districtKey: "dhaka" },
      }),
    ).toEqual([]);
  });

  it("gives a field without a section to the first section", () => {
    const fields = [
      fieldOf({ fieldKey: "a", sortOrder: 2, sectionKey: "family" }),
      fieldOf({ fieldKey: "b", sortOrder: 1 }),
      fieldOf({ fieldKey: "c", sortOrder: 1, sectionKey: "basics" }),
    ];
    expect(fieldsOfSection(fields, ["basics", "family"], "basics").map((f) => f.fieldKey)).toEqual([
      "b",
      "c",
    ]);
    expect(fieldsOfSection(fields, ["basics", "family"], "family").map((f) => f.fieldKey)).toEqual([
      "a",
    ]);
  });

  it("maps an API field path to the step that shows it", () => {
    expect(stepIndexOfPath("customFields.age", [["name"], ["age"]])).toBe(1);
    expect(stepIndexOfPath("customFields.unknown", [["name"]])).toBe(-1);
  });
});

describe("payload values", () => {
  it("leaves blank answers out and sends numbers as numbers", () => {
    const fields = [
      fieldOf({ fieldKey: "age", fieldType: "NUMBER" }),
      fieldOf({ fieldKey: "note" }),
      fieldOf({ fieldKey: "height", fieldType: "DECIMAL" }),
    ];
    expect(customFieldsPayload(fields, { age: "25", note: "", height: "5.5" })).toEqual({
      age: 25,
      height: 5.5,
    });
  });

  it("keeps a text that is not a number as typed so the API refuses it", () => {
    expect(payloadValueOf(fieldOf({ fieldKey: "age", fieldType: "NUMBER" }), "abc")).toBe("abc");
  });
});

describe("GEO_BD options", () => {
  it("offers the districts of the chosen division only", () => {
    const division = divisionOptions()[0];
    expect(division).toBeDefined();
    const districts = districtOptions(division?.divisionKey);
    expect(districts.length).toBeGreaterThan(0);
    expect(districtOptions("no-such-division")).toEqual([]);
    expect(districtOptions(undefined)).toEqual([]);
  });
});
