import type { CustomFieldRule } from "./custom-field-rule.js";

/** Drops sensitive values when the caller lacks the owning module's readSensitive permission. */
export function redactSensitive(
  values: Readonly<Record<string, unknown>>,
  fields: readonly CustomFieldRule[],
  canReadSensitive: boolean,
): Record<string, unknown> {
  if (canReadSensitive) return { ...values };
  const hidden = new Set(
    fields.filter((field) => field.isSensitive).map((field) => field.fieldKey),
  );
  const visible: Record<string, unknown> = {};
  for (const [fieldKey, value] of Object.entries(values)) {
    if (!hidden.has(fieldKey)) visible[fieldKey] = value;
  }
  return visible;
}

function searchText(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).toLowerCase());
  return [String(value).toLowerCase()];
}

/**
 * Lower-cased strings for the searchable fields, ready for an entity's `customFieldSearch` array
 * (ADR-015, ADR-102). Non-searchable fields are left out.
 */
export function toSearchEntries(
  values: Readonly<Record<string, unknown>>,
  fields: readonly CustomFieldRule[],
): { fieldKey: string; value: string }[] {
  const searchable = new Set(
    fields.filter((field) => field.isSearchable).map((field) => field.fieldKey),
  );
  const entries: { fieldKey: string; value: string }[] = [];
  for (const [fieldKey, value] of Object.entries(values)) {
    if (!searchable.has(fieldKey) || value === null || value === undefined) continue;
    for (const text of searchText(value)) entries.push({ fieldKey, value: text });
  }
  return entries;
}
