import { CUSTOM_FIELD_TYPE, type CustomFieldType } from "@banijjik/contracts";

/** How the storefront draws a listing field (M.6 C1). Every type the form read can return has one. */
export type FieldKind =
  | "text"
  | "longText"
  | "number"
  | "decimal"
  | "boolean"
  | "date"
  | "select"
  | "multiSelect"
  | "geo"
  | "phone"
  | "email"
  | "url";

const KIND_BY_TYPE: Readonly<Record<string, FieldKind>> = {
  [CUSTOM_FIELD_TYPE.TEXT]: "text",
  [CUSTOM_FIELD_TYPE.LONG_TEXT]: "longText",
  [CUSTOM_FIELD_TYPE.NUMBER]: "number",
  [CUSTOM_FIELD_TYPE.DECIMAL]: "decimal",
  [CUSTOM_FIELD_TYPE.BOOLEAN]: "boolean",
  [CUSTOM_FIELD_TYPE.DATE]: "date",
  [CUSTOM_FIELD_TYPE.SELECT]: "select",
  [CUSTOM_FIELD_TYPE.MULTI_SELECT]: "multiSelect",
  [CUSTOM_FIELD_TYPE.GEO_BD]: "geo",
  [CUSTOM_FIELD_TYPE.PHONE]: "phone",
  [CUSTOM_FIELD_TYPE.EMAIL]: "email",
  [CUSTOM_FIELD_TYPE.URL]: "url",
};

/** A type the listing form does not draw falls back to a plain text input (the API still validates it). */
export function fieldKindOf(fieldType: CustomFieldType): FieldKind {
  return KIND_BY_TYPE[fieldType] ?? "text";
}
