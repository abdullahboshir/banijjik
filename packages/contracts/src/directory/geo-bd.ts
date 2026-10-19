import {
  GEO_BD_DIVISIONS,
  type GeoBdDistrict,
  type GeoBdDivision,
  type GeoBdUpazila,
} from "./geo-bd-registry.js";

export type { GeoBdDistrict, GeoBdDivision, GeoBdName, GeoBdUpazila } from "./geo-bd-registry.js";
export { GEO_BD_DIVISIONS } from "./geo-bd-registry.js";

/** Value stored on a GEO_BD custom field (ADR-127). */
export interface GeoBdValue {
  readonly divisionKey: string;
  readonly districtKey: string;
  readonly upazilaKey?: string | undefined;
}

function divisionOf(divisionKey: string): GeoBdDivision | undefined {
  return GEO_BD_DIVISIONS.find((division) => division.divisionKey === divisionKey);
}

function districtOf(division: GeoBdDivision, districtKey: string): GeoBdDistrict | undefined {
  return division.districts.find((district) => district.districtKey === districtKey);
}

function upazilaOf(district: GeoBdDistrict, upazilaKey: string): GeoBdUpazila | undefined {
  return district.upazilas.find((upazila) => upazila.upazilaKey === upazilaKey);
}

/** True when the triple exists in the BBS-backed registry. */
export function isValidGeoBdValue(value: GeoBdValue): boolean {
  const division = divisionOf(value.divisionKey);
  if (division === undefined) return false;
  const district = districtOf(division, value.districtKey);
  if (district === undefined) return false;
  if (value.upazilaKey === undefined) return true;
  return upazilaOf(district, value.upazilaKey) !== undefined;
}

/**
 * Search tokens for a GEO_BD value so a filter can match division, district or upazila
 * (`divisionKey`, `divisionKey/districtKey`, full path).
 */
export function geoBdSearchTokens(value: GeoBdValue): string[] {
  const districtPath = `${value.divisionKey}/${value.districtKey}`;
  if (value.upazilaKey === undefined) {
    return [value.divisionKey, districtPath];
  }
  return [value.divisionKey, districtPath, `${districtPath}/${value.upazilaKey}`];
}

export function geoBdFilterToken(filter: {
  readonly divisionKey: string;
  readonly districtKey?: string | undefined;
  readonly upazilaKey?: string | undefined;
}): string {
  if (filter.districtKey === undefined) return filter.divisionKey;
  if (filter.upazilaKey === undefined) return `${filter.divisionKey}/${filter.districtKey}`;
  return `${filter.divisionKey}/${filter.districtKey}/${filter.upazilaKey}`;
}
