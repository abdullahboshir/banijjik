"use client";

import type { BookingResponse, ResourceResponse } from "@banijjik/contracts/booking";
import Link from "next/link";
import type { ReactElement } from "react";
import { localMinutesOfDay } from "./booking-calendar-layout";
import type { BookingCalendarQuery } from "./booking-query";

export function BookingCalendarMobile(props: {
  orgSlug: string;
  query: BookingCalendarQuery;
  timeZone: string;
  resources: readonly ResourceResponse[];
  bookings: readonly BookingResponse[];
  unnumberedLabel: string;
  minutesSuffix: string;
  addSlotLabel: string;
  canCreate: boolean;
  statusLabel: (status: BookingResponse["status"]) => string;
  onOpenSlot: (resourceId: string, minutesFromGridStart: number) => void;
}): ReactElement {
  return (
    <ul className="flex flex-col gap-4 md:hidden">
      {props.resources.map((resource) => (
        <li key={resource.resourceId} className="rounded-md border border-default bg-surface p-3">
          <h2 className="text-body font-semibold text-primary">{resource.name}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {props.bookings
              .filter((booking) => booking.resourceIds.includes(resource.resourceId))
              .map((booking) => (
                <li key={booking.bookingId}>
                  <Link
                    href={`/${props.orgSlug}/bookings/${booking.bookingId}`}
                    className="flex min-h-11 flex-col justify-center rounded-sm border border-default px-3 py-2"
                  >
                    <span className="text-body text-primary">
                      {booking.bookingNumber ?? props.unnumberedLabel}
                    </span>
                    <span className="text-small text-secondary">
                      {props.statusLabel(booking.status)} ·{" "}
                      {localMinutesOfDay(booking.startsAt, props.query.date, props.timeZone)}{" "}
                      {props.minutesSuffix}
                    </span>
                  </Link>
                </li>
              ))}
            {props.canCreate ? (
              <li>
                <button
                  type="button"
                  className="min-h-11 w-full rounded-sm border border-dashed border-default text-body text-secondary"
                  onClick={() => props.onOpenSlot(resource.resourceId, 0)}
                >
                  {props.addSlotLabel}
                </button>
              </li>
            ) : null}
          </ul>
        </li>
      ))}
    </ul>
  );
}
