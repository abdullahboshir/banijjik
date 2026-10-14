import { defineEnum } from "../define-enum.js";

/** The sixteen custom field types (01-ARCHITECTURE section 5). */
export const CUSTOM_FIELD_TYPE = defineEnum([
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DECIMAL",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "SELECT",
  "MULTI_SELECT",
  "PHONE",
  "EMAIL",
  "URL",
  "CURRENCY",
  "FILE",
  "IMAGE",
  "REFERENCE",
]);

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPE)[keyof typeof CUSTOM_FIELD_TYPE];
