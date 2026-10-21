import type { BookingResponse } from "@banijjik/contracts/booking";
import type { ScheduleRange } from "@banijjik/contracts/booking";

export const CALENDAR_DAY_START_MINUTES = 6 * 60;
export const CALENDAR_DAY_END_MINUTES = 22 * 60;
export const CALENDAR_SLOT_HEIGHT_PX = 28;

/** Minutes from midnight on `businessDate` in `timeZone` for an ISO instant. */
export function localMinutesOfDay(iso: string, businessDate: string, timeZone: string): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  const [hourText, minuteText] = formatted.split(":");
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  if (dayKey !== businessDate) {
    return hourText === "00" && minuteText === "00"
      ? CALENDAR_DAY_END_MINUTES
      : CALENDAR_DAY_START_MINUTES;
  }
  return Number(hourText) * 60 + Number(minuteText);
}

export function parseLocalTimeMinutes(localTime: string): number {
  const [hourText, minuteText] = localTime.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

/** The earliest and latest minutes shown on the grid from resource schedules. */
export function calendarBoundsFromSchedules(schedules: readonly (readonly ScheduleRange[])[]): {
  startMinutes: number;
  endMinutes: number;
} {
  let startMinutes = CALENDAR_DAY_START_MINUTES;
  let endMinutes = CALENDAR_DAY_END_MINUTES;
  for (const schedule of schedules) {
    for (const range of schedule) {
      startMinutes = Math.min(startMinutes, parseLocalTimeMinutes(range.opensAt));
      endMinutes = Math.max(endMinutes, parseLocalTimeMinutes(range.closesAt));
    }
  }
  if (endMinutes <= startMinutes) {
    return { startMinutes: CALENDAR_DAY_START_MINUTES, endMinutes: CALENDAR_DAY_END_MINUTES };
  }
  return { startMinutes, endMinutes };
}

export interface CalendarBookingBlock {
  readonly bookingId: string;
  readonly label: string;
  readonly topPx: number;
  readonly heightPx: number;
  readonly status: BookingResponse["status"];
}

export function bookingBlockOf(input: {
  booking: BookingResponse;
  label: string;
  businessDate: string;
  timeZone: string;
  startMinutes: number;
  slotStepMinutes: number;
}): CalendarBookingBlock {
  const start = localMinutesOfDay(input.booking.startsAt, input.businessDate, input.timeZone);
  const end = localMinutesOfDay(input.booking.endsAt, input.businessDate, input.timeZone);
  const topMinutes = Math.max(start - input.startMinutes, 0);
  const durationMinutes = Math.max(end - start, input.slotStepMinutes);
  const pxPerMinute = CALENDAR_SLOT_HEIGHT_PX / input.slotStepMinutes;
  return {
    bookingId: input.booking.bookingId,
    label: input.label,
    topPx: Math.round(topMinutes * pxPerMinute),
    heightPx: Math.max(Math.round(durationMinutes * pxPerMinute), CALENDAR_SLOT_HEIGHT_PX),
    status: input.booking.status,
  };
}

/** Snap a tap on the grid to the nearest slot start in local minutes. */
export function snapMinutesToSlot(minutesFromGridStart: number, slotStepMinutes: number): number {
  const snapped = Math.round(minutesFromGridStart / slotStepMinutes) * slotStepMinutes;
  return Math.max(snapped, 0);
}
