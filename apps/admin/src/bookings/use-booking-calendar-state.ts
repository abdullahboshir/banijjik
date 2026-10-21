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
} {
  const { startMinutes, endMinutes } = useMemo(
    () => calendarBoundsFromSchedules(props.resources.map((resource) => resource.weeklySchedule)),
    [props.resources],
  );
  const gridHeight =
    ((endMinutes - startMinutes) / props.slotStepMinutes) * CALENDAR_SLOT_HEIGHT_PX;
  const [seed, setSeed] = useState<{ resourceId: string; startsAt: string } | undefined>();

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
  }

  const bookingSeed = {
    locationId: props.locationId,
    businessDate: props.query.date,
    ...(seed?.resourceId === undefined ? {} : { resourceId: seed.resourceId }),
    ...(seed?.startsAt === undefined ? {} : { startsAt: seed.startsAt }),
  };

  return { startMinutes, endMinutes, gridHeight, openSlot, bookingSeed };
}
