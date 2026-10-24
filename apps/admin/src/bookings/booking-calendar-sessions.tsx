"use client";

import { useTranslator } from "@banijjik/web-client/client";
import Link from "next/link";
import type { ReactElement } from "react";
import { sessionsOnDate } from "./booking-calendar-layout";
import { formatLocalTimeRange } from "./booking-local-time";
import type { EventSessionView } from "./event-session-api";

/** Event sessions of the day as blocks with their seats; each links to the sessions screen. */
export function BookingCalendarSessions(props: {
  orgSlug: string;
  businessDate: string;
  timeZone: string;
  locale: string;
  sessions: readonly EventSessionView[];
  offeringNames: ReadonlyMap<string, string>;
}): ReactElement | null {
  const { t } = useTranslator();
  const today = sessionsOnDate(props.sessions, props.businessDate, props.timeZone);
  if (today.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={t("bookings.calendar.sessions")}>
      <h2 className="text-small font-semibold text-primary">{t("bookings.calendar.sessions")}</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {today.map((session) => (
          <li key={session.eventSessionId}>
            <Link
              href={`/${props.orgSlug}/bookings/event-sessions`}
              data-testid="calendar-session-block"
              className="flex min-h-11 flex-col justify-center rounded-md border border-default border-s-4 border-s-accent bg-surface px-3 py-2"
            >
              <span className="truncate text-body text-primary">
                {props.offeringNames.get(session.offeringId) ?? session.offeringId}
              </span>
              <span className="text-small text-secondary">
                {formatLocalTimeRange({
                  startsAt: session.startsAt,
                  endsAt: session.endsAt,
                  locale: props.locale,
                  timeZone: props.timeZone,
                })}{" "}
                ·{" "}
                {t("bookings.eventSessions.seatsSold", {
                  sold: session.seatsSold,
                  capacity: session.capacity,
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
