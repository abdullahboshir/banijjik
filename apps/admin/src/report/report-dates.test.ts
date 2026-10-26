import { describe, expect, it } from "vitest";
import {
  businessTodayIn,
  inclusiveDayCount,
  isBusinessDate,
  shiftBusinessDate,
} from "./report-dates";

describe("report dates", () => {
  it("names today in the business time zone, not the server UTC day", () => {
    // 20:30 UTC on 25 October is 02:30 on 26 October in Dhaka.
    const instant = new Date("2026-10-25T20:30:00Z");
    expect(businessTodayIn("Asia/Dhaka", instant)).toBe("2026-10-26");
    expect(businessTodayIn("UTC", instant)).toBe("2026-10-25");
  });

  it("moves a date across a month end and a leap day", () => {
    expect(shiftBusinessDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftBusinessDate("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("refuses a day that does not exist in the calendar", () => {
    expect(isBusinessDate("2026-02-30")).toBe(false);
    expect(isBusinessDate("2026-10-26")).toBe(true);
    expect(isBusinessDate("26-10-2026")).toBe(false);
  });

  it("counts both ends of an inclusive range and gives no days for a reversed one", () => {
    expect(inclusiveDayCount("2026-10-20", "2026-10-26")).toBe(7);
    expect(inclusiveDayCount("2026-10-26", "2026-10-20")).toBe(0);
  });
});
