import { describe, expect, it } from "vitest";
import {
  parsePosDevicesQuery,
  posDevicesApiPath,
  posDevicesHref,
  POS_DEVICES_PAGE_SIZE,
} from "./pos-devices-query";

const ORGANIZATION_ID = "0190a6a0-0000-7000-8000-0000000000e0";
const LOCATION_ID = "0190a6a0-0000-7000-8000-000000000001";
const BASE_PATH = "/acme/settings/pos-devices";

describe("the devices screen query", () => {
  it("reads a location id from the URL", () => {
    expect(parsePosDevicesQuery({ location: LOCATION_ID }).locationId).toBe(LOCATION_ID);
  });

  it("ignores a location value that is not an id", () => {
    expect(parsePosDevicesQuery({ location: "'; drop" }).locationId).toBeUndefined();
  });

  it("starts at page 1 when the page is missing, zero or not a number", () => {
    expect(parsePosDevicesQuery({}).page).toBe(1);
    expect(parsePosDevicesQuery({ page: "0" }).page).toBe(1);
    expect(parsePosDevicesQuery({ page: "abc" }).page).toBe(1);
  });

  it("reads the page number when it is a positive whole number", () => {
    expect(parsePosDevicesQuery({ page: "3" }).page).toBe(3);
  });
});

describe("the screen link", () => {
  it("is the bare path for all locations on the first page", () => {
    expect(posDevicesHref(BASE_PATH, { locationId: undefined, page: 1 })).toBe(BASE_PATH);
  });

  it("keeps the location and the page", () => {
    expect(posDevicesHref(BASE_PATH, { locationId: LOCATION_ID, page: 2 })).toBe(
      `${BASE_PATH}?location=${LOCATION_ID}&page=2`,
    );
  });
});

describe("the list request", () => {
  it("asks the API for one page of this screen's size, filtered to the location", () => {
    const path = posDevicesApiPath(ORGANIZATION_ID, { locationId: LOCATION_ID, page: 2 });
    expect(path).toBe(
      `/orgs/${ORGANIZATION_ID}/pos/devices?locationId=${LOCATION_ID}&page=2&limit=${POS_DEVICES_PAGE_SIZE}`,
    );
  });

  it("asks for every location when no location is chosen", () => {
    const path = posDevicesApiPath(ORGANIZATION_ID, { locationId: undefined, page: 1 });
    expect(path).not.toContain("locationId");
  });
});
