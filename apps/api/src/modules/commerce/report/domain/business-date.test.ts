import { describe, expect, it } from "vitest";
import {
  businessDateOf,
  businessDatesBetween,
  monthStartOf,
  shiftBusinessDate,
} from "./business-date.js";

const DHAKA = "Asia/Dhaka";

describe("the organization-local date", () => {
  it("the business date of an event is the organization-local date", () => {
    // 00:30 in Dhaka on 25 October is still 24 October in UTC: the Dhaka date wins.
    const thirtyMinutesPastMidnight = new Date("2026-10-24T18:30:00.000Z");
    expect(businessDateOf(thirtyMinutesPastMidnight, DHAKA)).toBe("2026-10-25");
  });

  it("a fact between 00:00 and 06:00 Dhaka time counts on the Dhaka day, not the UTC day", () => {
    for (const utcInstant of ["2026-10-24T18:00:00.000Z", "2026-10-24T23:59:00.000Z"]) {
      expect(businessDateOf(new Date(utcInstant), DHAKA)).toBe("2026-10-25");
    }
    expect(businessDateOf(new Date("2026-10-24T17:59:00.000Z"), DHAKA)).toBe("2026-10-24");
  });
});

describe("business day arithmetic", () => {
  it("moves a day across a month end and a leap day", () => {
    expect(shiftBusinessDate("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftBusinessDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(monthStartOf("2026-10-25")).toBe("2026-10-01");
  });

  it("lists every day of a range, both ends included, oldest first", () => {
    expect(businessDatesBetween("2026-10-30", "2026-11-01")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });
});
