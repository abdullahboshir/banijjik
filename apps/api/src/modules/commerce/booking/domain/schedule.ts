import type { ScheduleRange, Weekday } from "@banijjik/contracts/booking";
import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import { bookingRuleError } from "./errors.js";
import { localDateTimeToUtc, localTimeOf, weekdayOf } from "./timezone.js";

function timeToMinutes(localTime: string): number {
  const [hours, minutes] = localTime.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Refuses overlapping ranges on the same weekday. */
export function assertScheduleValid(schedule: readonly ScheduleRange[]): void {
  const byDay = new Map<Weekday, ScheduleRange[]>();
  for (const range of schedule) {
    const list = byDay.get(range.weekday) ?? [];
    list.push(range);
    byDay.set(range.weekday, list);
  }
  for (const ranges of byDay.values()) {
    const ordered = [...ranges].sort(
      (left, right) => timeToMinutes(left.opensAt) - timeToMinutes(right.opensAt),
    );
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (previous === undefined || current === undefined) continue;
      if (timeToMinutes(previous.closesAt) > timeToMinutes(current.opensAt)) {
        throw bookingRuleError(BOOKING_RULE_KEY.SCHEDULE_OVERLAP);
      }
    }
  }
}

export function rangesForWeekday(
  schedule: readonly ScheduleRange[],
  weekday: Weekday,
): readonly ScheduleRange[] {
  return schedule.filter((range) => range.weekday === weekday);
}

export function isWithinSchedule(input: {
  startsAt: Date;
  endsAt: Date;
  schedule: readonly ScheduleRange[];
  timeZone: string;
}): boolean {
  const weekday = weekdayOf(input.startsAt, input.timeZone);
  const startLocal = localTimeOf(input.startsAt, input.timeZone);
  const endLocal = localTimeOf(input.endsAt, input.timeZone);
  if (businessDayCrosses(input.startsAt, input.endsAt, input.timeZone)) return false;
  return rangesForWeekday(input.schedule, weekday).some(
    (range) => startLocal >= range.opensAt && endLocal <= range.closesAt,
  );
}

function businessDayCrosses(startsAt: Date, endsAt: Date, timeZone: string): boolean {
  const startDay = weekdayOf(startsAt, timeZone);
  const endDay = weekdayOf(new Date(endsAt.getTime() - 1), timeZone);
  return startDay !== endDay;
}

export function overlapsTimeOff(
  startsAt: Date,
  endsAt: Date,
  timeOff: readonly { startsAt: Date; endsAt: Date }[],
): boolean {
  return timeOff.some((block) => startsAt < block.endsAt && endsAt > block.startsAt);
}

export function slotWindowUtc(input: {
  businessDate: string;
  opensAt: string;
  closesAt: string;
  timeZone: string;
}): { start: Date; end: Date } {
  return {
    start: localDateTimeToUtc(input.businessDate, input.opensAt, input.timeZone),
    end: localDateTimeToUtc(input.businessDate, input.closesAt, input.timeZone),
  };
}
