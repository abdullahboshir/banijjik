import { describe, expect, it } from "vitest";
import { applyMondayToWeek, emptyWeekdayRows, scheduleFromRows } from "./resource-schedule";

describe("resource schedule editor helpers", () => {
  it("keeps one open range per weekday row", () => {
    const rows = emptyWeekdayRows().map((row) =>
      row.weekday === 1 ? { ...row, opensAt: "09:00", closesAt: "17:00" } : row,
    );
    expect(scheduleFromRows(rows)).toEqual([{ weekday: 1, opensAt: "09:00", closesAt: "17:00" }]);
  });

  it("copies Monday hours to empty weekdays", () => {
    const rows = applyMondayToWeek(
      emptyWeekdayRows().map((row) =>
        row.weekday === 1 ? { ...row, opensAt: "10:00", closesAt: "18:00" } : row,
      ),
    );
    expect(rows.find((row) => row.weekday === 5)).toEqual({
      weekday: 5,
      opensAt: "10:00",
      closesAt: "18:00",
    });
  });
});
