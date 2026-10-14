import { defineEnum } from "../define-enum.js";

/**
 * Every entity a manifest may name in `customFieldEntities` (card 2.3).
 * A manifest still stores the names as strings; startup refuses a name that is not in this list.
 */
export const CUSTOM_FIELD_ENTITY_TYPE = defineEnum([
  "organization",
  "location",
  "member",
  "contact",
  "offering",
  "category",
  "order",
  "booking",
  "enrollment",
  "resource",
  "expense",
]);

export type CustomFieldEntityType =
  (typeof CUSTOM_FIELD_ENTITY_TYPE)[keyof typeof CUSTOM_FIELD_ENTITY_TYPE];

const ENTITY_TYPES: readonly string[] = Object.values(CUSTOM_FIELD_ENTITY_TYPE);

export function isCustomFieldEntityType(value: string): value is CustomFieldEntityType {
  return ENTITY_TYPES.includes(value);
}
