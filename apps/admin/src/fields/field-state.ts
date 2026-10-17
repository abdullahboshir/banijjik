import { CUSTOM_FIELD_TYPE, type CustomFieldType } from "@banijjik/contracts";
import type { FieldErrors } from "../auth/field-errors";
import type { FieldRowView } from "./field-rows";

/** Types a person can fill in today; file, image and reference come with the modules that own them. */
export const FIELD_TYPE_CHOICES: readonly CustomFieldType[] = [
  CUSTOM_FIELD_TYPE.TEXT,
  CUSTOM_FIELD_TYPE.LONG_TEXT,
  CUSTOM_FIELD_TYPE.NUMBER,
  CUSTOM_FIELD_TYPE.DECIMAL,
  CUSTOM_FIELD_TYPE.CURRENCY,
  CUSTOM_FIELD_TYPE.BOOLEAN,
  CUSTOM_FIELD_TYPE.DATE,
  CUSTOM_FIELD_TYPE.DATETIME,
  CUSTOM_FIELD_TYPE.SELECT,
  CUSTOM_FIELD_TYPE.MULTI_SELECT,
  CUSTOM_FIELD_TYPE.PHONE,
  CUSTOM_FIELD_TYPE.EMAIL,
  CUSTOM_FIELD_TYPE.URL,
];

/** Every input of the field form as the person sees it: plain text and switches. */
export interface FieldFormState {
  fieldKey: string;
  labelBn: string;
  labelEn: string;
  fieldType: CustomFieldType;
  isRequired: boolean;
  isSensitive: boolean;
  isSearchable: boolean;
  botAsk: boolean;
  /** One option per line. */
  optionsText: string;
  sortOrder: string;
}

export const FIELD_FORM_NAMES: readonly string[] = [
  "fieldKey",
  "labelBn",
  "labelEn",
  "fieldType",
  "options",
  "sortOrder",
];

export type FieldFormResult<Body> =
  { ok: true; body: Body } | { ok: false; fieldErrors: FieldErrors };

export function emptyFieldForm(sortOrder: number): FieldFormState {
  return {
    fieldKey: "",
    labelBn: "",
    labelEn: "",
    fieldType: CUSTOM_FIELD_TYPE.TEXT,
    isRequired: false,
    isSensitive: false,
    isSearchable: false,
    botAsk: false,
    optionsText: "",
    sortOrder: String(sortOrder),
  };
}

export function formOfField(row: FieldRowView): FieldFormState {
  return {
    fieldKey: row.fieldKey,
    labelBn: row.labelBn,
    labelEn: row.labelEn,
    fieldType: row.fieldType,
    isRequired: row.isRequired,
    isSensitive: row.isSensitive,
    isSearchable: row.isSearchable,
    botAsk: row.botAsk,
    optionsText: row.options.join("\n"),
    sortOrder: String(row.sortOrder),
  };
}

export function needsOptions(fieldType: CustomFieldType): boolean {
  return fieldType === CUSTOM_FIELD_TYPE.SELECT || fieldType === CUSTOM_FIELD_TYPE.MULTI_SELECT;
}
