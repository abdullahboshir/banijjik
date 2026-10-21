"use client";

import { useLazyComponent } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import type { BookingCalendarClientProps } from "./booking-calendar-client";

async function loadCalendar() {
  const loaded = await import("./booking-calendar-client");
  return loaded.BookingCalendarClient;
}

export function LazyBookingCalendar(props: BookingCalendarClientProps): ReactElement {
  const Calendar = useLazyComponent(loadCalendar, true);
  if (!Calendar) return <p className="text-small text-secondary">{props.labels.loading}</p>;
  return <Calendar {...props} />;
}
