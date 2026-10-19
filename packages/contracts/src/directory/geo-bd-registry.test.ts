import { describe, expect, it } from "vitest";
import { GEO_BD_DIVISIONS, isValidGeoBdValue } from "./geo-bd.js";

describe("GEO_BD registry (BBS administrative list)", () => {
  it("has 8 divisions and 64 districts", () => {
    expect(GEO_BD_DIVISIONS).toHaveLength(8);
    const districts = GEO_BD_DIVISIONS.flatMap((division) => division.districts);
    expect(districts).toHaveLength(64);
  });

  it("places every district under its division with bn and en names", () => {
    for (const division of GEO_BD_DIVISIONS) {
      expect(division.divisionKey.length).toBeGreaterThan(0);
      expect(division.name.bn.length).toBeGreaterThan(0);
      expect(division.name.en.length).toBeGreaterThan(0);
      expect(division.districts.length).toBeGreaterThan(0);
      for (const district of division.districts) {
        expect(district.districtKey.length).toBeGreaterThan(0);
        expect(district.name.bn.length).toBeGreaterThan(0);
        expect(district.name.en.length).toBeGreaterThan(0);
        expect(district.upazilas.length).toBeGreaterThan(0);
        for (const upazila of district.upazilas) {
          expect(upazila.upazilaKey.length).toBeGreaterThan(0);
          expect(upazila.name.bn.length).toBeGreaterThan(0);
          expect(upazila.name.en.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("accepts a known triple and refuses an unknown district under a division", () => {
    const division = GEO_BD_DIVISIONS[0];
    const district = division?.districts[0];
    const upazila = district?.upazilas[0];
    expect(division).toBeDefined();
    expect(district).toBeDefined();
    expect(upazila).toBeDefined();
    if (division === undefined || district === undefined || upazila === undefined) return;
    expect(
      isValidGeoBdValue({
        divisionKey: division.divisionKey,
        districtKey: district.districtKey,
        upazilaKey: upazila.upazilaKey,
      }),
    ).toBe(true);
    expect(
      isValidGeoBdValue({
        divisionKey: division.divisionKey,
        districtKey: "not-a-real-district",
      }),
    ).toBe(false);
  });
});
