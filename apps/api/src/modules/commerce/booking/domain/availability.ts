import type { ScheduleRange } from "@banijjik/contracts/booking";
import { addMinutes, businessDateOf, localDateTimeToUtc, weekdayOf } from "./timezone.js";
import { isWithinSchedule, overlapsTimeOff, rangesForWeekday, slotWindowUtc } from "./schedule.js";
import { bucketStartsCovering } from "./buckets.js";

export interface SlotCandidate {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly blockedEndsAt: Date;
}

/** Customer-visible end excludes buffer; blocked end includes bufferAfterMinutes for capacity. */
export function slotBounds(
  startsAt: Date,
  durationMinutes: number,
  bufferAfterMinutes: number,
): { readonly endsAt: Date; readonly blockedEndsAt: Date } {
  const endsAt = addMinutes(startsAt, durationMinutes);
  return { endsAt, blockedEndsAt: addMinutes(endsAt, bufferAfterMinutes) };
}

export function generateSlotStarts(input: {
  readonly businessDate: string;
  readonly timeZone: string;
  readonly schedule: readonly ScheduleRange[];
  readonly slotStepMinutes: number;
  readonly durationMinutes: number;
  readonly bufferAfterMinutes: number;
  readonly now: Date;
  readonly minNoticeMinutes: number;
  readonly maxAdvanceDays: number;
}): SlotCandidate[] {
  const weekday = weekdayOf(
    localDateTimeToUtc(input.businessDate, "12:00", input.timeZone),
    input.timeZone,
  );
  const ranges = rangesForWeekday(input.schedule, weekday);
  const earliest = addMinutes(input.now, input.minNoticeMinutes);
  const latest = addMinutes(input.now, input.maxAdvanceDays * 24 * 60);
  const slots: SlotCandidate[] = [];
  for (const range of ranges) {
    const window = slotWindowUtc({
      businessDate: input.businessDate,
      opensAt: range.opensAt,
      closesAt: range.closesAt,
      timeZone: input.timeZone,
    });
    for (
      let cursor = window.start.getTime();
      cursor + input.durationMinutes * 60_000 <= window.end.getTime();
      cursor += input.slotStepMinutes * 60_000
    ) {
      const startsAt = new Date(cursor);
      const { endsAt, blockedEndsAt } = slotBounds(
        startsAt,
        input.durationMinutes,
        input.bufferAfterMinutes,
      );
      if (startsAt < earliest || startsAt > latest) continue;
      if (
        !isWithinSchedule({
          startsAt,
          endsAt: blockedEndsAt,
          schedule: input.schedule,
          timeZone: input.timeZone,
        })
      ) {
        continue;
      }
      slots.push({ startsAt, endsAt, blockedEndsAt });
    }
  }
  return slots;
}

export function slotFreeInBuckets(input: {
  readonly capacity: number;
  readonly usedByBucket: ReadonlyMap<number, number>;
  readonly startsAt: Date;
  readonly blockedEndsAt: Date;
}): boolean {
  for (const bucketStart of bucketStartsCovering(input.startsAt, input.blockedEndsAt)) {
    const used = input.usedByBucket.get(bucketStart.getTime()) ?? 0;
    if (used >= input.capacity) return false;
  }
  return true;
}

export function filterByTimeOff(
  slots: readonly SlotCandidate[],
  timeOff: readonly { startsAt: Date; endsAt: Date }[],
): SlotCandidate[] {
  return slots.filter((slot) => !overlapsTimeOff(slot.startsAt, slot.blockedEndsAt, timeOff));
}

export function businessDateMatches(
  instant: Date,
  businessDate: string,
  timeZone: string,
): boolean {
  return businessDateOf(instant, timeZone) === businessDate;
}
