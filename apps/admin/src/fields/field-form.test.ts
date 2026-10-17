import { describe, expect, it } from "vitest";
import {
  buildFieldCreate,
  buildFieldUpdate,
  buildPreferenceChange,
  emptyFieldForm,
  formOfField,
} from "./field-form";
import type { FieldRowView } from "./field-rows";

function aRow(overrides: Partial<FieldRowView> = {}): FieldRowView {
  return {
    entityType: "member",
    fieldKey: "blood_group",
    scope: "ORGANIZATION",
    label: "রক্তের গ্রুপ",
    labelBn: "রক্তের গ্রুপ",
    labelEn: "Blood group",
    fieldType: "SELECT",
    typeLabel: "একটি বিকল্প",
    isRequired: false,
    isSensitive: false,
    isSearchable: false,
    botAsk: false,
    options: ["A_POS", "B_POS"],
    sortOrder: 20,
    version: 3,
    customFieldDefinitionId: "definition-1",
    canEdit: true,
    canArchive: true,
    canCustomize: false,
    canHide: false,
    ...overrides,
  };
}

describe("buildFieldCreate", () => {
  it("builds the create body with the record type and the bot visibility from the switch", () => {
    const form = {
      ...emptyFieldForm(30),
      fieldKey: "nid",
      labelBn: "জাতীয় পরিচয়পত্র",
      labelEn: "National ID",
      isSensitive: true,
      botAsk: true,
    };

    const result = buildFieldCreate(form, "member");

    expect(result).toEqual({
      ok: true,
      body: expect.objectContaining({
        entityType: "member",
        fieldKey: "nid",
        fieldType: "TEXT",
        isSensitive: true,
        sortOrder: 30,
        visibility: { admin: true, storefront: false, bot: true },
      }),
    });
  });

  it("puts a bad key, a missing name and missing choices on their inputs", () => {
    const form = { ...emptyFieldForm(10), fieldKey: "Bad Key", fieldType: "SELECT" as const };

    const result = buildFieldCreate(form, "member");

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : Object.keys(result.fieldErrors).sort()).toEqual(
      ["fieldKey", "labelBn", "labelEn", "options"].sort(),
    );
    expect(result.ok ? undefined : result.fieldErrors["labelBn"]).toBe("validation.required");
  });

  it("splits the choices by line and ignores blank lines", () => {
    const form = {
      ...emptyFieldForm(10),
      fieldKey: "grade",
      labelBn: "গ্রেড",
      labelEn: "Grade",
      fieldType: "SELECT" as const,
      optionsText: "A\n\n B \n",
    };

    const result = buildFieldCreate(form, "member");

    expect(result.ok && result.body.options).toEqual(["A", "B"]);
  });
});

describe("buildFieldUpdate", () => {
  it("sends nothing when nothing changed", () => {
    expect(buildFieldUpdate(formOfField(aRow()), aRow())).toEqual({ ok: true, body: undefined });
  });

  it("sends only the changed fields with the version it read, and never the key or the type", () => {
    const form = { ...formOfField(aRow()), labelEn: "Blood type", isSensitive: true };

    const result = buildFieldUpdate(form, aRow());

    expect(result).toEqual({
      ok: true,
      body: { version: 3, label: { bn: "রক্তের গ্রুপ", en: "Blood type" }, isSensitive: true },
    });
  });

  it("lets a choice be added", () => {
    const form = { ...formOfField(aRow()), optionsText: "A_POS\nB_POS\nO_POS" };

    const result = buildFieldUpdate(form, aRow());

    expect(result).toEqual({
      ok: true,
      body: { version: 3, options: ["A_POS", "B_POS", "O_POS"] },
    });
  });

  it("refuses to remove a choice that exists", () => {
    const form = { ...formOfField(aRow()), optionsText: "A_POS" };

    expect(buildFieldUpdate(form, aRow())).toEqual({
      ok: false,
      fieldErrors: { options: "errors.custom_field_options_locked" },
    });
  });
});

describe("buildPreferenceChange", () => {
  const template = aRow({ scope: "INDUSTRY", version: 0, customFieldDefinitionId: undefined });

  it("sends the new label and order for a template field with no saved preference, without a version", () => {
    const result = buildPreferenceChange(
      { labelBn: "রক্ত", labelEn: "Blood", sortOrder: "5" },
      template,
    );

    expect(result).toEqual({
      ok: true,
      body: {
        entityType: "member",
        fieldKey: "blood_group",
        label: { bn: "রক্ত", en: "Blood" },
        sortOrder: 5,
      },
    });
  });

  it("carries the version of an existing preference", () => {
    const result = buildPreferenceChange(
      { labelBn: template.labelBn, labelEn: template.labelEn, sortOrder: "7" },
      { ...template, version: 2 },
    );

    expect(result).toEqual({
      ok: true,
      body: { entityType: "member", fieldKey: "blood_group", sortOrder: 7, version: 2 },
    });
  });

  it("sends nothing when nothing changed, and refuses an empty label or a fractional order", () => {
    const same = { labelBn: template.labelBn, labelEn: template.labelEn, sortOrder: "20" };

    expect(buildPreferenceChange(same, template)).toEqual({ ok: true, body: undefined });
    expect(buildPreferenceChange({ ...same, labelEn: " " }, template).ok).toBe(false);
    expect(buildPreferenceChange({ ...same, sortOrder: "1.5" }, template).ok).toBe(false);
  });
});
