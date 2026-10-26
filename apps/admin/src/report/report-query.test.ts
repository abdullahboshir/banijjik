import { describe, expect, it } from "vitest";
import {
  dailyReportPath,
  homeLocationOf,
  homeReportPath,
  parseReportRangeQuery,
} from "./report-query";

const TODAY = "2026-10-26";
const LOCATION_ID = "0196e4a2-1c2d-7e3f-8a4b-5c6d7e8f9a0b";

describe("parseReportRangeQuery", () => {
  it("defaults to the last 7 days up to today", () => {
    expect(parseReportRangeQuery({}, TODAY)).toEqual({
      from: "2026-10-20",
      to: "2026-10-26",
      locationId: undefined,
    });
  });

  it("keeps a valid range and a location from the URL", () => {
    const query = parseReportRangeQuery(
      { from: "2026-10-01", to: "2026-10-31", location: LOCATION_ID },
      TODAY,
    );
    expect(query).toEqual({ from: "2026-10-01", to: "2026-10-31", locationId: LOCATION_ID });
  });

  it("falls back to the default when the range is reversed", () => {
    const query = parseReportRangeQuery({ from: "2026-10-26", to: "2026-10-01" }, TODAY);
    expect(query.from).toBe("2026-10-20");
    expect(query.to).toBe("2026-10-26");
  });

  it("falls back to the default when the range is longer than the API allows", () => {
    const query = parseReportRangeQuery({ from: "2026-01-01", to: "2026-10-26" }, TODAY);
    expect(query.from).toBe("2026-10-20");
  });

  it("ignores a location that is not an id shape", () => {
    expect(parseReportRangeQuery({ location: "x; drop" }, TODAY).locationId).toBeUndefined();
  });
});

describe("report API paths", () => {
  it("asks the daily read for every day of the range in one page", () => {
    const path = dailyReportPath("org-1", {
      from: "2026-10-20",
      to: "2026-10-26",
      locationId: undefined,
    });
    expect(path).toBe("/orgs/org-1/reports/daily?from=2026-10-20&to=2026-10-26&limit=100");
  });

  it("adds the location only when one is chosen", () => {
    expect(homeReportPath("org-1", undefined)).toBe("/orgs/org-1/reports/home");
    expect(homeReportPath("org-1", LOCATION_ID)).toBe(
      `/orgs/org-1/reports/home?location=${LOCATION_ID}`,
    );
  });

  it("reads the home location from the URL", () => {
    expect(homeLocationOf({ location: LOCATION_ID })).toBe(LOCATION_ID);
    expect(homeLocationOf({})).toBeUndefined();
  });
});
