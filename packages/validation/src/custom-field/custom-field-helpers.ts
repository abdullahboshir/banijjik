import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import {
  geoBdSearchTokens,
  LISTING_FIELD_TIER,
  type GeoBdValue,
} from "@banijjik/contracts/directory";
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

function isGeoBdValue(value: unknown): value is GeoBdValue {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record["divisionKey"] === "string" && typeof record["districtKey"] === "string";
}

/**
 * Lower-cased strings for the searchable fields, ready for an entity's `customFieldSearch` array
 * (ADR-015, ADR-102). Non-searchable fields are left out, and so is every sensitive field even when
 * it is searchable: a sensitive field is never searchable by value (ADR-107), because the entries
 * are a plain, indexed copy that would bypass the redaction.
 */
export function toSearchEntries(
  values: Readonly<Record<string, unknown>>,
  fields: readonly CustomFieldRule[],
): { fieldKey: string; value: string }[] {
  const searchable = new Set(
    fields
      .filter((field) => field.isSearchable && !field.isSensitive)
      .map((field) => field.fieldKey),
  );
  const entries: { fieldKey: string; value: string }[] = [];
  for (const [fieldKey, value] of Object.entries(values)) {
    if (!searchable.has(fieldKey) || value === null || value === undefined) continue;
    for (const text of searchText(value)) entries.push({ fieldKey, value: text });
  }
  return entries;
}

const INDEXABLE_TIERS = new Set<string>([LISTING_FIELD_TIER.PUBLIC, LISTING_FIELD_TIER.MEMBERS]);

function listingFilterValues(field: CustomFieldRule, value: unknown): string[] {
  if (field.fieldType === CUSTOM_FIELD_TYPE.GEO_BD && isGeoBdValue(value)) {
    return geoBdSearchTokens(value);
  }
  if (field.fieldType === CUSTOM_FIELD_TYPE.NUMBER && typeof value === "number") {
    return [String(value).padStart(16, "0")];
  }
  return searchText(value);
}

/**
 * Directory filter index entries (ADR-127): only filterable PUBLIC/MEMBERS fields.
 * UNLOCKED and PRIVATE values never enter the index.
 */
export function toListingFilterEntries(
  values: Readonly<Record<string, unknown>>,
  fields: readonly CustomFieldRule[],
): { fieldKey: string; value: string }[] {
  const byKey = new Map(fields.map((field) => [field.fieldKey, field]));
  const entries: { fieldKey: string; value: string }[] = [];
  for (const [fieldKey, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    const field = byKey.get(fieldKey);
    if (field === undefined || field.isFilterable !== true) continue;
    const tier = field.listingTier ?? LISTING_FIELD_TIER.PUBLIC;
    if (!INDEXABLE_TIERS.has(tier)) continue;
    for (const text of listingFilterValues(field, value)) {
      entries.push({ fieldKey, value: text });
    }
  }
  return entries;
}
