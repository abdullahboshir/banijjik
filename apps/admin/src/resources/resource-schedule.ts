import type { ScheduleRange, Weekday } from "@banijjik/contracts/booking";
import { WEEKDAYS } from "@banijjik/contracts/booking";

export interface WeekdayScheduleRow {
  readonly weekday: Weekday;
  readonly opensAt: string;
  readonly closesAt: string;
}

export function emptyWeekdayRows(): WeekdayScheduleRow[] {
  return WEEKDAYS.map((weekday) => ({ weekday, opensAt: "", closesAt: "" }));
}

export function scheduleFromRows(rows: readonly WeekdayScheduleRow[]): ScheduleRange[] {
  return rows
    .filter((row) => row.opensAt !== "" && row.closesAt !== "")
    .map((row) => ({
      weekday: row.weekday,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
    }));
}

export function rowsFromSchedule(schedule: readonly ScheduleRange[]): WeekdayScheduleRow[] {
  const byDay = new Map(schedule.map((range) => [range.weekday, range]));
  return WEEKDAYS.map((weekday) => {
    const match = byDay.get(weekday);
    return {
      weekday,
      opensAt: match?.opensAt ?? "",
      closesAt: match?.closesAt ?? "",
    };
  });
}

/** Copies Monday's hours to every weekday that is still empty. */
export function applyMondayToWeek(rows: readonly WeekdayScheduleRow[]): WeekdayScheduleRow[] {
  const monday = rows.find((row) => row.weekday === 1);
  if (monday === undefined || monday.opensAt === "" || monday.closesAt === "") return [...rows];
  return rows.map((row) =>
    row.opensAt === "" && row.closesAt === ""
      ? { ...row, opensAt: monday.opensAt, closesAt: monday.closesAt }
      : row,
  );
}
