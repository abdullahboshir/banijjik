import {
  CUSTOM_FIELD_TYPE,
  type CustomFieldType,
  type EffectiveCustomField,
} from "@banijjik/contracts";
import { createTranslator } from "@banijjik/i18n";
import { CUSTOM_FIELD_AUDIENCE, CUSTOM_FIELD_VALUE_MODE } from "@banijjik/validation";
import { describe, expect, it } from "vitest";
import {
  toFieldDescriptors,
  toRequestValues,
  validateCustomFieldValues,
} from "./custom-field-form.js";

const adminOnly = { admin: true, storefront: false, bot: false };

function field(
  fieldType: CustomFieldType,
  overrides: Partial<EffectiveCustomField> = {},
): EffectiveCustomField {
  return {
    scope: "INDUSTRY",
    isEditable: false,
    entityType: "contact",
    fieldKey: fieldType.toLowerCase(),
    fieldType,
    label: { bn: `${fieldType} বাংলা`, en: `${fieldType} English` },
    isRequired: false,
    visibility: adminOnly,
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: 0,
    version: 0,
    status: "ACTIVE",
    ...overrides,
  };
}

const translator = createTranslator({ locale: "bn", brandName: "Example" });

describe("toFieldDescriptors", () => {
  it("maps the thirteen editable types and keeps file, image and reference pending", () => {
    const model = toFieldDescriptors(
      Object.values(CUSTOM_FIELD_TYPE).map((fieldType) => field(fieldType)),
      "en",
      translator.t,
    );
    expect(model.fields.map((item) => item.inputKind)).toEqual([
      "TEXT",
      "LONG_TEXT",
      "INTEGER",
      "DECIMAL",
      "BOOLEAN",
      "DATE",
      "DATETIME",
      "SELECT",
      "MULTI_SELECT",
      "PHONE",
      "EMAIL",
      "URL",
      "MONEY",
    ]);
    expect(model.pendingFieldKeys).toEqual(["file", "image", "reference"]);
  });

  it("picks the Bangla label and the Bangla option label", () => {
    const model = toFieldDescriptors(
      [
        field(CUSTOM_FIELD_TYPE.SELECT, {
          fieldKey: "skin_type",
          label: { bn: "ত্বকের ধরন", en: "Skin type" },
          options: ["OILY"],
          optionLabels: { OILY: { bn: "তৈলাক্ত", en: "Oily" } },
        }),
      ],
      "bn",
      translator.t,
    );
    expect(model.fields[0]?.label).toBe("ত্বকের ধরন");
    expect(model.fields[0]?.options?.[0]).toEqual({ value: "OILY", label: "তৈলাক্ত" });
  });

  it("hides a field the admin audience cannot see", () => {
    const model = toFieldDescriptors(
      [
        field(CUSTOM_FIELD_TYPE.TEXT, {
          visibility: { admin: false, storefront: true, bot: false },
        }),
      ],
      "en",
      translator.t,
    );
    expect(model.fields).toEqual([]);
    expect(model.pendingFieldKeys).toEqual([]);
  });
});

describe("validateCustomFieldValues", () => {
  const note = field(CUSTOM_FIELD_TYPE.TEXT, { fieldKey: "note", isRequired: true });
  const weight = field(CUSTOM_FIELD_TYPE.DECIMAL, { fieldKey: "weight" });
  const day = field(CUSTOM_FIELD_TYPE.DATE, { fieldKey: "day" });

  it("agrees with the shared schema on required, null, unknown keys, a decimal float and a bad date", () => {
    const options = { audience: CUSTOM_FIELD_AUDIENCE.ADMIN, mode: CUSTOM_FIELD_VALUE_MODE.CREATE };
    expect(validateCustomFieldValues([note], {}, options).note).toBe("validation.invalid_type");
    expect(
      validateCustomFieldValues(
        [note],
        { note: null },
        {
          audience: CUSTOM_FIELD_AUDIENCE.ADMIN,
          mode: CUSTOM_FIELD_VALUE_MODE.UPDATE,
        },
      ).note,
    ).toBe("validation.invalid_type");
    expect(validateCustomFieldValues([note], { other: "x" }, options).other).toBe(
      "validation.unrecognized_keys",
    );
    expect(validateCustomFieldValues([weight], { weight: 1.2 }, options).weight).toBe(
      "validation.invalid_type",
    );
    expect(validateCustomFieldValues([day], { day: "2026-02-30" }, options).day).toBe(
      "validation.custom",
    );
  });
});

describe("toRequestValues", () => {
  const note = field(CUSTOM_FIELD_TYPE.TEXT, { fieldKey: "note" });

  it("sends null for a cleared optional field on update and omits it on create", () => {
    expect(toRequestValues({ note: "" }, [note], CUSTOM_FIELD_VALUE_MODE.UPDATE)).toEqual({
      note: null,
    });
    expect(toRequestValues({ note: "  " }, [note], CUSTOM_FIELD_VALUE_MODE.CREATE)).toEqual({});
    expect(toRequestValues({ note: "kept" }, [note], CUSTOM_FIELD_VALUE_MODE.CREATE)).toEqual({
      note: "kept",
    });
  });
});
