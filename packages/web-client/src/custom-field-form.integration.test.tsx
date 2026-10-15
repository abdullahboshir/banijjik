/**
 * @vitest-environment jsdom
 */
import { CUSTOM_FIELD_TYPE, type EffectiveCustomField } from "@banijjik/contracts";
import { createTranslator } from "@banijjik/i18n";
import { CustomFieldInputs } from "@banijjik/ui";
import {
  buildCustomFieldValuesSchema,
  CUSTOM_FIELD_AUDIENCE,
  CUSTOM_FIELD_VALUE_MODE,
} from "@banijjik/validation";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { toFieldDescriptors, toRequestValues } from "./custom-field-form.js";

afterEach(cleanup);

function salonField(
  partial: Pick<EffectiveCustomField, "fieldKey" | "fieldType"> & Partial<EffectiveCustomField>,
): EffectiveCustomField {
  return {
    scope: "INDUSTRY",
    isEditable: false,
    entityType: "contact",
    label: { bn: partial.fieldKey, en: partial.fieldKey },
    isRequired: false,
    visibility: { admin: true, storefront: false, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: 0,
    version: 0,
    status: "ACTIVE",
    ...partial,
  };
}

/** Contact fields from the SALON industry seed, plus one storefront-only field that must stay hidden. */
function salonContactFields(): EffectiveCustomField[] {
  return [
    salonField({
      fieldKey: "skin_type",
      fieldType: CUSTOM_FIELD_TYPE.SELECT,
      label: { bn: "ত্বকের ধরন", en: "Skin type" },
      options: ["NORMAL", "OILY", "DRY", "SENSITIVE"],
      optionLabels: {
        NORMAL: { bn: "স্বাভাবিক", en: "Normal" },
        OILY: { bn: "তৈলাক্ত", en: "Oily" },
        DRY: { bn: "শুষ্ক", en: "Dry" },
        SENSITIVE: { bn: "সংবেদনশীল", en: "Sensitive" },
      },
    }),
    salonField({
      fieldKey: "hair_type",
      fieldType: CUSTOM_FIELD_TYPE.SELECT,
      label: { bn: "চুলের ধরন", en: "Hair type" },
      options: ["STRAIGHT", "WAVY", "CURLY"],
      optionLabels: {
        STRAIGHT: { bn: "সোজা", en: "Straight" },
        WAVY: { bn: "ঢেউ খেলানো", en: "Wavy" },
        CURLY: { bn: "কোঁকড়ানো", en: "Curly" },
      },
    }),
    salonField({
      fieldKey: "allergies",
      fieldType: CUSTOM_FIELD_TYPE.LONG_TEXT,
      isSensitive: true,
      label: { bn: "অ্যালার্জি", en: "Allergies" },
    }),
    salonField({
      fieldKey: "preferred_stylist",
      fieldType: CUSTOM_FIELD_TYPE.REFERENCE,
      label: { bn: "পছন্দের স্টাইলিস্ট", en: "Preferred stylist" },
    }),
    salonField({
      fieldKey: "public_note",
      fieldType: CUSTOM_FIELD_TYPE.TEXT,
      visibility: { admin: false, storefront: true, bot: false },
      label: { bn: "দোকানের নোট", en: "Shop note" },
    }),
  ];
}

function SalonForm({ onSubmit }: { onSubmit: (values: Record<string, unknown>) => void }) {
  const translator = createTranslator({ locale: "bn", brandName: "Example" });
  const fields = salonContactFields();
  const model = toFieldDescriptors(fields, "bn", translator.t);
  const [values, setValues] = useState<Record<string, unknown>>({});
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(toRequestValues(values, fields, CUSTOM_FIELD_VALUE_MODE.CREATE));
      }}
    >
      <CustomFieldInputs
        fields={model.fields}
        pendingFields={model.pendingFields}
        values={values}
        errors={{}}
        onChange={(fieldKey, value) => setValues((current) => ({ ...current, [fieldKey]: value }))}
        idPrefix="salon"
        currencySymbol="৳"
        chooseLabel={model.chooseLabel}
        notEditableText={model.notEditableText}
      />
      <button type="submit">Save</button>
    </form>
  );
}

describe("salon contact fields", () => {
  it("fills the seed fields and the produced map passes the shared schema", async () => {
    let submitted: Record<string, unknown> = {};
    render(<SalonForm onSubmit={(values) => (submitted = values)} />);
    expect(screen.queryByText("দোকানের নোট")).toBeNull();
    expect(screen.getByText("পছন্দের স্টাইলিস্ট")).not.toBeNull();
    expect(screen.getByText("এই ঘর এখানে সম্পাদনা করা যায় না")).not.toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "ত্বকের ধরন" }), "OILY");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "চুলের ধরন" }), "STRAIGHT");
    await userEvent.type(screen.getByRole("textbox", { name: "অ্যালার্জি" }), "nuts");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const parsed = buildCustomFieldValuesSchema(salonContactFields(), {
      audience: CUSTOM_FIELD_AUDIENCE.ADMIN,
      mode: CUSTOM_FIELD_VALUE_MODE.CREATE,
    }).safeParse(submitted);
    expect(parsed.success).toBe(true);
    expect(submitted).toEqual({
      skin_type: "OILY",
      hair_type: "STRAIGHT",
      allergies: "nuts",
    });
  });
});
