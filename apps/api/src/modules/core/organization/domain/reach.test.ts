import { ALL_LOCATIONS } from "@banijjik/contracts";
import { asId, newId, type LocationId, type RoleId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import type { Assignment } from "./member.entity.js";
import { firstAssignmentOutsideReach, isWithinReach } from "./reach.js";

const LOCATION_ONE = asId<LocationId>(newId());
const LOCATION_TWO = asId<LocationId>(newId());
const ROLE = asId<RoleId>(newId());

function assign(locationId: LocationId | typeof ALL_LOCATIONS): Assignment {
  return { locationId, roleId: ROLE };
}

describe("isWithinReach", () => {
  it("accepts every assignment for a caller whose reach is ALL", () => {
    expect(isWithinReach([assign(ALL_LOCATIONS), assign(LOCATION_ONE)], "ALL")).toBe(true);
  });

  it("accepts only the named locations for a caller limited to some, and never ALL", () => {
    expect(isWithinReach([assign(LOCATION_ONE)], [LOCATION_ONE])).toBe(true);
    expect(isWithinReach([assign(LOCATION_TWO)], [LOCATION_ONE])).toBe(false);
    expect(isWithinReach([assign(ALL_LOCATIONS)], [LOCATION_ONE])).toBe(false);
  });

  it("rejects a record when even one of its assignments is outside the reach", () => {
    const assignments = [assign(LOCATION_ONE), assign(LOCATION_TWO)];
    expect(isWithinReach(assignments, [LOCATION_ONE])).toBe(false);
    expect(isWithinReach(assignments, [LOCATION_ONE, LOCATION_TWO])).toBe(true);
  });

  it("reaches nothing with an empty reach", () => {
    expect(isWithinReach([assign(LOCATION_ONE)], [])).toBe(false);
  });
});

describe("firstAssignmentOutsideReach", () => {
  it("names the first assignment outside the reach, and none when all are inside", () => {
    const outside = assign(LOCATION_TWO);

    expect(firstAssignmentOutsideReach([assign(LOCATION_ONE), outside], [LOCATION_ONE])).toBe(
      outside,
    );
    expect(firstAssignmentOutsideReach([assign(LOCATION_ONE)], [LOCATION_ONE])).toBeUndefined();
  });
});
