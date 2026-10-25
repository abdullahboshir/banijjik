import type { GeoBdValue, StorefrontListingField } from "@banijjik/contracts/directory";

export type FieldValues = Readonly<Record<string, unknown>>;

/**
 * The form's steps are the template's sections in template order (M.6 C3). A field without a
 * `sectionKey` belongs to the first section, so no field is left without a step.
 */
export function fieldsOfSection(
  fields: readonly StorefrontListingField[],
  sectionKeys: readonly string[],
  sectionKey: string,
): readonly StorefrontListingField[] {
  const firstSectionKey = sectionKeys[0];
  return fields
    .filter((field) => (field.sectionKey ?? firstSectionKey) === sectionKey)
    .sort((first, second) => first.sortOrder - second.sortOrder);
}

/** An empty answer: nothing, a blank text, an empty list, or a GEO_BD value without a district. */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return geoIsEmpty(value as Partial<GeoBdValue>);
  return false;
}

function geoIsEmpty(value: Partial<GeoBdValue>): boolean {
  return value.divisionKey === undefined || value.districtKey === undefined;
}

/** The required fields of one step that have no answer yet (the client check; the API is the authority). */
export function missingRequiredKeys(
  stepFields: readonly StorefrontListingField[],
  values: FieldValues,
): readonly string[] {
  return stepFields
    .filter((field) => field.isRequired && isEmptyValue(values[field.fieldKey]))
    .map((field) => field.fieldKey);
}

/** The step (index) a field path such as `customFields.age_band` belongs to, or -1 when none does. */
export function stepIndexOfPath(
  path: string,
  stepFieldKeys: readonly (readonly string[])[],
): number {
  const fieldKey = path.startsWith("customFields.") ? path.slice("customFields.".length) : path;
  return stepFieldKeys.findIndex((keys) => keys.includes(fieldKey));
}
