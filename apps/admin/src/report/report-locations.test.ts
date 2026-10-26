import type { CallerPermissionsResponse, LocationResponse } from "@banijjik/contracts";
import { PERMISSION_KEY } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { showsLocationFilter } from "./report-locations";

const KEY = PERMISSION_KEY.REPORT_HOME_READ;
const FIRST = "0196e4a2-0000-7000-8000-000000000001";
const SECOND = "0196e4a2-0000-7000-8000-000000000002";

function locationWith(locationId: string): LocationResponse {
  return { locationId, name: locationId } as LocationResponse;
}

const TWO_LOCATIONS = [locationWith(FIRST), locationWith(SECOND)];

describe("showsLocationFilter", () => {
  it("shows the filter to an owner with every location", () => {
    const permissions: CallerPermissionsResponse = { allLocations: [KEY], byLocation: {} };
    expect(showsLocationFilter(permissions, KEY, TWO_LOCATIONS)).toBe(true);
  });

  it("hides the filter from a member assigned to one location only", () => {
    const permissions: CallerPermissionsResponse = {
      allLocations: [],
      byLocation: { [FIRST]: [KEY] },
    };
    expect(showsLocationFilter(permissions, KEY, TWO_LOCATIONS)).toBe(false);
  });

  it("shows the filter to a member assigned to two locations", () => {
    const permissions: CallerPermissionsResponse = {
      allLocations: [],
      byLocation: { [FIRST]: [KEY], [SECOND]: [KEY] },
    };
    expect(showsLocationFilter(permissions, KEY, TWO_LOCATIONS)).toBe(true);
  });
});
