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

/** Whether an instant lies before, on or after the shown business day in the organization timezone. */
export function dayRelationOf(
  iso: string,
  businessDate: string,
  timeZone: string,
): "before" | "on" | "after" {
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  if (dayKey === businessDate) return "on";
  return dayKey < businessDate ? "before" : "after";
}

export interface CalendarBookingBlock {
  readonly bookingId: string;
  readonly label: string;
  readonly kind: BookingResponse["kind"];
  /** A rental that started on an earlier day, or that ends on a later one, runs off the grid. */
  readonly continuesBefore: boolean;
  readonly continuesAfter: boolean;
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
  /** The last minute of the grid; a booking that runs past the day is cut there. */
  endMinutes?: number;
  slotStepMinutes: number;
}): CalendarBookingBlock {
  const startRelation = dayRelationOf(input.booking.startsAt, input.businessDate, input.timeZone);
  const endRelation = dayRelationOf(input.booking.endsAt, input.businessDate, input.timeZone);
  const start =
    startRelation === "before"
      ? input.startMinutes
      : localMinutesOfDay(input.booking.startsAt, input.businessDate, input.timeZone);
  const end =
    endRelation === "after"
      ? (input.endMinutes ?? CALENDAR_DAY_END_MINUTES)
      : localMinutesOfDay(input.booking.endsAt, input.businessDate, input.timeZone);
  const topMinutes = Math.max(start - input.startMinutes, 0);
  const durationMinutes = Math.max(end - start, input.slotStepMinutes);
  const pxPerMinute = CALENDAR_SLOT_HEIGHT_PX / input.slotStepMinutes;
  return {
    bookingId: input.booking.bookingId,
    label: input.label,
    kind: input.booking.kind,
    continuesBefore: startRelation === "before",
    continuesAfter: endRelation === "after",
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

/** The sessions that run on the shown day, earliest first. A session that spans midnight shows on both days. */
export function sessionsOnDate<Session extends { startsAt: string; endsAt: string }>(
  sessions: readonly Session[],
  businessDate: string,
  timeZone: string,
): Session[] {
  return sessions
    .filter(
      (session) =>
        dayRelationOf(session.startsAt, businessDate, timeZone) !== "after" &&
        dayRelationOf(session.endsAt, businessDate, timeZone) !== "before",
    )
    .sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt));
}
