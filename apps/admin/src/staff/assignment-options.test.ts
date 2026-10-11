import type { LocationResponse } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { buildAssignmentOptions } from "./assignment-options";
import { FIRST_LOCATION_ID, ROLES, SECOND_LOCATION_ID, role, translate } from "./test-fixtures";

function location(locationId: string, name: string): LocationResponse {
  return {
    locationId,
    name,
    locationType: "STORE",
    isDefault: false,
    status: "ACTIVE",
    version: 1,
  };
}

const EVERYWHERE = { allLocations: ["organization.member.update" as const], byLocation: {} };
const LIMITED = {
  allLocations: [],
  byLocation: { [FIRST_LOCATION_ID]: ["organization.member.update" as const] },
};

describe("buildAssignmentOptions", () => {
  it("never offers the owner role, and leaves out archived roles", () => {
    const options = buildAssignmentOptions({
      roles: [...ROLES, role("role-old", "CASHIER", { status: "ARCHIVED" })],
      locations: [location(FIRST_LOCATION_ID, "মূল শাখা")],
      permissions: EVERYWHERE,
      t: translate,
    });
    expect(options.roles.map((option) => option.roleId)).toEqual(["role-manager", "role-staff"]);
  });

  it("names a system role from the catalog and a custom role by its own name", () => {
    const options = buildAssignmentOptions({
      roles: [
        role("r1", "MANAGER"),
        role("r2", "custom.r2", { nameKey: undefined, name: "ডেলিভারি" }),
      ],
      locations: [],
      permissions: EVERYWHERE,
      t: translate,
    });
    expect(options.roles.map((option) => option.label)).toEqual(["ম্যানেজার", "ডেলিভারি"]);
  });

  it("is single-location mode for a caller at every location who sees one location", () => {
    const options = buildAssignmentOptions({
      roles: ROLES,
      locations: [location(FIRST_LOCATION_ID, "মূল শাখা")],
      permissions: EVERYWHERE,
      t: translate,
    });
    expect(options.isSingleLocation).toBe(true);
  });

  it("offers All locations only to a caller who works everywhere, and keeps the select for a limited caller", () => {
    const locations = [
      location(FIRST_LOCATION_ID, "মূল শাখা"),
      location(SECOND_LOCATION_ID, "দ্বিতীয়"),
    ];
    const wide = buildAssignmentOptions({
      roles: ROLES,
      locations,
      permissions: EVERYWHERE,
      t: translate,
    });
    const narrow = buildAssignmentOptions({
      roles: ROLES,
      locations: [location(FIRST_LOCATION_ID, "মূল শাখা")],
      permissions: LIMITED,
      t: translate,
    });
    expect(wide.locations.map((option) => option.locationId)).toEqual([
      "ALL",
      FIRST_LOCATION_ID,
      SECOND_LOCATION_ID,
    ]);
    expect(narrow.isSingleLocation).toBe(false);
    expect(narrow.locations.map((option) => option.locationId)).toEqual([FIRST_LOCATION_ID]);
  });
});
