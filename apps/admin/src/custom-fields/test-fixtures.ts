import { CUSTOM_FIELD_TYPE, type EffectiveCustomField } from "@banijjik/contracts";

type FieldPartial = Pick<EffectiveCustomField, "fieldKey" | "fieldType"> &
  Partial<EffectiveCustomField>;

/** An effective field the way `/me/config.fields` returns it; the label is the key unless a test sets one. */
export function effectiveField(partial: FieldPartial): EffectiveCustomField {
  return {
    scope: "ORGANIZATION",
    isEditable: true,
    entityType: "member",
    label: { bn: partial.fieldKey, en: partial.fieldKey },
    isRequired: false,
    visibility: { admin: true, storefront: false, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: 0,
    version: 1,
    status: "ACTIVE",
    ...partial,
  };
}

/** Staff profile fields: a phone, a select, an optional sensitive note and a required text. */
export function staffProfileFields(): EffectiveCustomField[] {
  return [
    effectiveField({
      fieldKey: "emergency_contact",
      fieldType: CUSTOM_FIELD_TYPE.PHONE,
      label: { bn: "জরুরি যোগাযোগ", en: "Emergency contact" },
    }),
    effectiveField({
      fieldKey: "blood_group",
      fieldType: CUSTOM_FIELD_TYPE.SELECT,
      label: { bn: "রক্তের গ্রুপ", en: "Blood group" },
      options: ["A_POS", "B_POS"],
      optionLabels: { A_POS: { bn: "এ+", en: "A+" }, B_POS: { bn: "বি+", en: "B+" } },
    }),
    effectiveField({
      fieldKey: "medical_notes",
      fieldType: CUSTOM_FIELD_TYPE.LONG_TEXT,
      isSensitive: true,
      label: { bn: "চিকিৎসা নোট", en: "Medical notes" },
    }),
    effectiveField({
      fieldKey: "nid",
      fieldType: CUSTOM_FIELD_TYPE.TEXT,
      isRequired: true,
      label: { bn: "জাতীয় পরিচয়পত্র", en: "National ID" },
    }),
  ];
}
