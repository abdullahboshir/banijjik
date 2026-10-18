import {
  CUSTOM_FIELD_TYPE,
  type CustomFieldType,
  type EffectiveCustomField,
} from "@banijjik/contracts";
import { createTranslator } from "@banijjik/i18n";
import { CUSTOM_FIELD_AUDIENCE, CUSTOM_FIELD_VALUE_MODE } from "@banijjik/validation";
import { describe, expect, it } from "vitest";
import {
  fieldsForContactRoles,
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
  it("maps the fifteen editable types and keeps only reference pending", () => {
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
      "FILE",
      "IMAGE",
    ]);
    expect(model.pendingFieldKeys).toEqual(["reference"]);
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

describe("file and image fields", () => {
  const photo = field(CUSTOM_FIELD_TYPE.IMAGE, { fieldKey: "photo" });
  const scan = field(CUSTOM_FIELD_TYPE.FILE, { fieldKey: "scan" });

  it("gives them the labels of the image and file inputs in the user's language", () => {
    const model = toFieldDescriptors([photo, scan], "bn", translator.t);

    expect(model.imageLabels.choose).toBe(translator.t("form.image.choose"));
    expect(model.fileLabels.attached).toBe(translator.t("form.file.attached"));
    expect(model.imageLabels.choose).not.toBe("form.image.choose");
  });

  it("sends the saved file id on update and null when the optional file is removed", () => {
    expect(
      toRequestValues(
        { photo: "0198aaaa-0000-7000-8000-000000000001" },
        [photo],
        CUSTOM_FIELD_VALUE_MODE.UPDATE,
      ),
    ).toEqual({ photo: "0198aaaa-0000-7000-8000-000000000001" });
    expect(toRequestValues({ photo: null }, [photo], CUSTOM_FIELD_VALUE_MODE.UPDATE)).toEqual({
      photo: null,
    });
    expect(toRequestValues({ scan: undefined }, [scan], CUSTOM_FIELD_VALUE_MODE.CREATE)).toEqual(
      {},
    );
  });

  it("agrees with the shared schema that the value must be an id", () => {
    const options = { audience: CUSTOM_FIELD_AUDIENCE.ADMIN, mode: CUSTOM_FIELD_VALUE_MODE.CREATE };

    expect(validateCustomFieldValues([photo], { photo: "not-an-id" }, options).photo).toBeDefined();
    expect(
      validateCustomFieldValues(
        [photo],
        { photo: "0198aaaa-0000-7000-8000-000000000001" },
        options,
      ),
    ).toEqual({});
  });
});

describe("contact-link fields (card 3.1b)", () => {
  const guardian = field(CUSTOM_FIELD_TYPE.REFERENCE, {
    fieldKey: "guardian",
    isRequired: true,
    referenceEntity: "contact",
    link: { relationKey: "GUARDIAN_OF", createIfMissingByPhone: true, defaultBillTo: true },
  });
  const memberReference = field(CUSTOM_FIELD_TYPE.REFERENCE, {
    fieldKey: "buddy",
    referenceEntity: "member",
  });

  it("gives a contact-link reference an input and leaves any other reference pending", () => {
    const model = toFieldDescriptors([guardian, memberReference], "en", translator.t);

    expect(model.fields.map((item) => [item.fieldKey, item.inputKind])).toEqual([
      ["guardian", "CONTACT_LINK"],
    ]);
    expect(model.pendingFieldKeys).toEqual(["buddy"]);
    expect(model.contactLinkLabels.createNew).toBeDefined();
  });

  it("sends the link value in the request and still leaves a pending reference out", () => {
    const create = { create: { name: "Rina", phone: "01712340000" } };

    const request = toRequestValues(
      { guardian: create, buddy: "x" },
      [guardian, memberReference],
      CUSTOM_FIELD_VALUE_MODE.CREATE,
    );

    expect(request).toEqual({ guardian: create });
  });

  it("accepts { create } for the admin form only when asked", () => {
    const create = { guardian: { create: { name: "Rina", phone: "01712340000" } } };
    const options = { audience: CUSTOM_FIELD_AUDIENCE.ADMIN, mode: CUSTOM_FIELD_VALUE_MODE.CREATE };

    expect(validateCustomFieldValues([guardian], create, options)).toEqual({
      guardian: expect.any(String),
    });
    expect(
      validateCustomFieldValues([guardian], create, { ...options, acceptsContactLinkCreate: true }),
    ).toEqual({});
  });

  it("leaves out a field that applies to other roles", () => {
    const classLevel = field(CUSTOM_FIELD_TYPE.TEXT, {
      fieldKey: "class_level",
      appliesToContactRoles: ["CUSTOMER"],
    });

    expect(
      fieldsForContactRoles([classLevel, guardian], ["RELATED"]).map((item) => item.fieldKey),
    ).toEqual(["guardian"]);
    expect(fieldsForContactRoles([classLevel], ["CUSTOMER", "RELATED"])).toHaveLength(1);
  });
});
