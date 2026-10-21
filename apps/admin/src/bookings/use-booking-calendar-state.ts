"use client";

import { useMemo, useState } from "react";
import {
  calendarBoundsFromSchedules,
  CALENDAR_SLOT_HEIGHT_PX,
  snapMinutesToSlot,
} from "./booking-calendar-layout";
import { localDateTimeToIso, minutesToLocalTime } from "./booking-local-time";
import type { BookingCalendarClientProps } from "./booking-calendar-client";

export function useBookingCalendarState(
  props: Pick<
    BookingCalendarClientProps,
    "resources" | "query" | "timeZone" | "slotStepMinutes" | "locationId"
  >,
): {
  startMinutes: number;
  endMinutes: number;
  gridHeight: number;
  openSlot: (resourceId: string, minutesFromGridStart: number) => void;
  bookingSeed: {
    locationId: string;
    businessDate: string;
    resourceId?: string;
    startsAt?: string;
  };
  /** Counts slot taps: the sheet opens seeded instead of waiting for its own button (plan 3.6 item 9). */
  bookingSheetReveal: number;
} {
  const { startMinutes, endMinutes } = useMemo(
    () => calendarBoundsFromSchedules(props.resources.map((resource) => resource.weeklySchedule)),
    [props.resources],
  );
  const gridHeight =
    ((endMinutes - startMinutes) / props.slotStepMinutes) * CALENDAR_SLOT_HEIGHT_PX;
  const [seed, setSeed] = useState<{ resourceId: string; startsAt: string } | undefined>();
  const [bookingSheetReveal, setBookingSheetReveal] = useState(0);

  function openSlot(resourceId: string, minutesFromGridStart: number): void {
    const localMinutes =
      startMinutes + snapMinutesToSlot(minutesFromGridStart, props.slotStepMinutes);
    setSeed({
      resourceId,
      startsAt: localDateTimeToIso(
        props.query.date,
        minutesToLocalTime(localMinutes),
        props.timeZone,
      ),
    });
    setBookingSheetReveal((reveal) => reveal + 1);
  }

  const bookingSeed = {
    locationId: props.locationId,
    businessDate: props.query.date,
    ...(seed?.resourceId === undefined ? {} : { resourceId: seed.resourceId }),
    ...(seed?.startsAt === undefined ? {} : { startsAt: seed.startsAt }),
  };

  return { startMinutes, endMinutes, gridHeight, openSlot, bookingSeed, bookingSheetReveal };
}
