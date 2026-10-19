import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import { geoBdFilterToken } from "@banijjik/contracts/directory";
import type { CustomFieldRule } from "@banijjik/validation";
import { filterNotAllowed } from "../domain/errors.js";
import type { ListingSearchFilter } from "./ports/listing-repository.js";

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

function isRangeSuffix(body: string): boolean {
  return (
    body.endsWith(".min") ||
    body.endsWith(".max") ||
    body.endsWith(".ageMin") ||
    body.endsWith(".ageMax") ||
    body.endsWith(".districtKey") ||
    body.endsWith(".upazilaKey")
  );
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
  if (field.fieldType === CUSTOM_FIELD_TYPE.NUMBER) {
    return numberFilter(fieldKey, rawQuery);
  }
  if (field.fieldType === CUSTOM_FIELD_TYPE.DATE) {
    return dateFilter({ fieldKey, rawQuery, value, now });
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
  const filters: ListingSearchFilter[] = [];
  for (const [key, value] of Object.entries(rawQuery)) {
    if (!key.startsWith("f.")) continue;
    const body = key.slice(2);
    if (isRangeSuffix(body)) continue;
    if (body.endsWith(".divisionKey")) {
      const fieldKey = body.slice(0, -".divisionKey".length);
      filters.push(
        geoFilter({ fieldKey, field: filterable.get(fieldKey), rawQuery, divisionKey: value }),
      );
      continue;
    }
    if (body.includes(".")) continue;
    const field = filterable.get(body);
    if (field === undefined) throw filterNotAllowed(body);
    filters.push(valueFilter({ fieldKey: body, field, value, rawQuery, now }));
  }
  return filters;
}
