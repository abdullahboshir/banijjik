"use client";

import type { BookingResponse, ResourceResponse } from "@banijjik/contracts/booking";
import { useTranslator } from "@banijjik/web-client/client";
import { useScreenText } from "./screen-text";
import Link from "next/link";
import type { ReactElement } from "react";
import { localMinutesOfDay } from "./booking-calendar-layout";
import type { BookingCalendarQuery } from "./booking-query";

/** A rental that runs past the shown day says when it ends, so the person sees where the bar goes next. */
function RentalUntilLine(props: { endsAt: string; timeZone: string }): ReactElement {
  const { locale } = useTranslator();
  const t = useScreenText();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: props.timeZone });
  return (
    <span className="text-small text-secondary">
      {t("bookings.calendar.rentalUntil", { date: date.format(new Date(props.endsAt)) })}
    </span>
  );
}

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
                    {booking.kind === "RENTAL" ? (
                      <RentalUntilLine endsAt={booking.endsAt} timeZone={props.timeZone} />
                    ) : null}
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
