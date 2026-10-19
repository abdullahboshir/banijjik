import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import { geoBdFilterToken } from "@banijjik/contracts/directory";
import type { CustomFieldRule } from "@banijjik/validation";
import { filterNotAllowed } from "../domain/errors.js";
import type { ListingSearchFilter } from "./ports/listing-repository.js";

const RANGE_SUFFIXES = [
  ".min",
  ".max",
  ".ageMin",
  ".ageMax",
  ".districtKey",
  ".upazilaKey",
] as const;

function ageToDateBounds(
  ageMin: number | undefined,
  ageMax: number | undefined,
  now: Date,
): { minValue?: string; maxValue?: string } {
  const result: { minValue?: string; maxValue?: string } = {};
  if (ageMax !== undefined) {
    const year = now.getUTCFullYear() - ageMax;
    result.minValue = `${year}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  }
  if (ageMin !== undefined) {
    const year = now.getUTCFullYear() - ageMin;
    result.maxValue = `${year}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  }
  return result;
}

function rangeFieldKey(body: string): string | undefined {
  for (const suffix of RANGE_SUFFIXES) {
    if (body.endsWith(suffix)) return body.slice(0, -suffix.length);
  }
  return undefined;
}

function geoFilter(input: {
  readonly fieldKey: string;
  readonly field: CustomFieldRule | undefined;
  readonly rawQuery: Record<string, unknown>;
  readonly divisionKey: unknown;
}): ListingSearchFilter {
  const { fieldKey, field, rawQuery, divisionKey } = input;
  if (field === undefined || field.fieldType !== CUSTOM_FIELD_TYPE.GEO_BD) {
    throw filterNotAllowed(fieldKey);
  }
  const districtKey = rawQuery[`f.${fieldKey}.districtKey`];
  const upazilaKey = rawQuery[`f.${fieldKey}.upazilaKey`];
  return {
    fieldKey,
    value: geoBdFilterToken({
      divisionKey: String(divisionKey),
      ...(typeof districtKey === "string" ? { districtKey } : {}),
      ...(typeof upazilaKey === "string" ? { upazilaKey } : {}),
    }),
  };
}

function numberFilter(fieldKey: string, rawQuery: Record<string, unknown>): ListingSearchFilter {
  const min = rawQuery[`f.${fieldKey}.min`];
  const max = rawQuery[`f.${fieldKey}.max`];
  return {
    fieldKey,
    value: "",
    ...(min !== undefined ? { minValue: String(Number(min)).padStart(16, "0") } : {}),
    ...(max !== undefined ? { maxValue: String(Number(max)).padStart(16, "0") } : {}),
  };
}

function dateFilter(input: {
  readonly fieldKey: string;
  readonly rawQuery: Record<string, unknown>;
  readonly value: unknown;
  readonly now: Date;
}): ListingSearchFilter {
  const ageMin = input.rawQuery[`f.${input.fieldKey}.ageMin`];
  const ageMax = input.rawQuery[`f.${input.fieldKey}.ageMax`];
  if (ageMin !== undefined || ageMax !== undefined) {
    return {
      fieldKey: input.fieldKey,
      value: "",
      ...ageToDateBounds(
        ageMin === undefined ? undefined : Number(ageMin),
        ageMax === undefined ? undefined : Number(ageMax),
        input.now,
      ),
    };
  }
  return { fieldKey: input.fieldKey, value: String(input.value).toLowerCase() };
}

function valueFilter(input: {
  readonly fieldKey: string;
  readonly field: CustomFieldRule;
  readonly value: unknown;
  readonly rawQuery: Record<string, unknown>;
  readonly now: Date;
}): ListingSearchFilter {
  const { fieldKey, field, value, rawQuery, now } = input;
  if (field.fieldType === CUSTOM_FIELD_TYPE.MULTI_SELECT) {
    const values = Array.isArray(value) ? value.map(String) : [String(value)];
    return { fieldKey, value: "", anyOf: values.map((item) => item.toLowerCase()) };
  }
  if (field.fieldType === CUSTOM_FIELD_TYPE.NUMBER) return numberFilter(fieldKey, rawQuery);
  if (field.fieldType === CUSTOM_FIELD_TYPE.DATE) {
    return dateFilter({ fieldKey, rawQuery, value, now });
  }
  if (field.fieldType === CUSTOM_FIELD_TYPE.GEO_BD) {
    const divisionKey = rawQuery[`f.${fieldKey}.divisionKey`];
    if (divisionKey === undefined) throw filterNotAllowed(fieldKey);
    return geoFilter({ fieldKey, field, rawQuery, divisionKey });
  }
  return { fieldKey, value: String(value).toLowerCase() };
}

/** Turns `f.<fieldKey>…` query keys into attribute-pattern search filters (ADR-127). */
export function listingFiltersFromQuery(
  rawQuery: Record<string, unknown>,
  fields: readonly CustomFieldRule[],
  now: Date,
): ListingSearchFilter[] {
  const filterable = new Map(
    fields.filter((field) => field.isFilterable === true).map((field) => [field.fieldKey, field]),
  );
  const seen = new Set<string>();
  const filters: ListingSearchFilter[] = [];

  const pushField = (fieldKey: string, value: unknown): void => {
    if (seen.has(fieldKey)) return;
    seen.add(fieldKey);
    const field = filterable.get(fieldKey);
    if (field === undefined) throw filterNotAllowed(fieldKey);
    filters.push(valueFilter({ fieldKey, field, value, rawQuery, now }));
  };

  for (const [key, value] of Object.entries(rawQuery)) {
    if (!key.startsWith("f.")) continue;
    const body = key.slice(2);
    if (body.endsWith(".divisionKey")) {
      pushField(body.slice(0, -".divisionKey".length), value);
      continue;
    }
    const ranged = rangeFieldKey(body);
    if (ranged !== undefined) {
      pushField(ranged, value);
      continue;
    }
    if (body.includes(".")) continue;
    pushField(body, value);
  }
  return filters;
}
