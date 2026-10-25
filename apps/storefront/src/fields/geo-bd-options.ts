import {
  GEO_BD_DIVISIONS,
  type GeoBdDistrict,
  type GeoBdDivision,
} from "@banijjik/contracts/directory";

/** The division list of the BBS registry, for the first select of a GEO_BD field. */
export function divisionOptions(): readonly GeoBdDivision[] {
  return GEO_BD_DIVISIONS;
}

/** The districts of a division, for the dependent second select. An unknown key gives none. */
export function districtOptions(divisionKey: string | undefined): readonly GeoBdDistrict[] {
  const division = GEO_BD_DIVISIONS.find((item) => item.divisionKey === divisionKey);
  return division?.districts ?? [];
}
