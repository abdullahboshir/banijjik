"use client";

import type { ReactElement } from "react";
import { useTranslator } from "@banijjik/web-client/client";
import { BookingCalendarDesktop } from "./booking-calendar-desktop";
import { BookingCalendarMobile } from "./booking-calendar-mobile";
import { ScreenTextProvider, type ScreenTexts } from "./screen-text";
import { BookingCalendarSessions } from "./booking-calendar-sessions";
import type { EventSessionView } from "./event-session-api";
import { BookingCalendarToolbar } from "./booking-calendar-toolbar";
import { bookingStatusLabelOf } from "./booking-labels";
import type { NewBookingSheetLabels } from "./new-booking-sheet";
import type { BookingCalendarQuery } from "./booking-query";
import type { BookingResponse, ResourceResponse } from "@banijjik/contracts/booking";
import type { OfferingResponse } from "@banijjik/contracts/catalog";
import { useBookingCalendarState } from "./use-booking-calendar-state";

export interface BookingCalendarClientProps {
  orgSlug: string;
  organizationId: string;
  query: BookingCalendarQuery;
  locationId: string;
  timeZone: string;
  locale: string;
  slotStepMinutes: number;
  resources: readonly ResourceResponse[];
  bookings: readonly BookingResponse[];
  offerings: readonly OfferingResponse[];
  eventSessions: readonly EventSessionView[];
  canCreate: boolean;
  labels: {
    loading: string;
    addBooking: string;
    addSlot: string;
    unnumbered: string;
    minutesSuffix: string;
    sheet: NewBookingSheetLabels;
  };
  texts: ScreenTexts;
}

function BookingCalendarBody(props: BookingCalendarClientProps): ReactElement {
  const calendar = useBookingCalendarState(props);
  // A client calendar reads its own translations: a server page may not pass a function through props.
  const { t } = useTranslator();
  const statusLabel = (status: BookingResponse["status"]): string =>
    bookingStatusLabelOf(status, t);

  return (
    <div className="flex flex-col gap-4">
      <BookingCalendarToolbar
        canCreate={props.canCreate}
        addBookingLabel={props.labels.addBooking}
        organizationId={props.organizationId}
        locationId={props.locationId}
        timeZone={props.timeZone}
        locale={props.locale}
        businessDate={props.query.date}
        offerings={props.offerings}
        resources={props.resources}
        seed={calendar.bookingSeed}
        sheetLabels={props.labels.sheet}
        revealSignal={calendar.bookingSheetReveal}
      />
      <BookingCalendarDesktop
        orgSlug={props.orgSlug}
        query={props.query}
        timeZone={props.timeZone}
        slotStepMinutes={props.slotStepMinutes}
        resources={props.resources}
        bookings={props.bookings}
        gridHeight={calendar.gridHeight}
        startMinutes={calendar.startMinutes}
        unnumberedLabel={props.labels.unnumbered}
        canCreate={props.canCreate}
        statusLabel={statusLabel}
        onOpenSlot={calendar.openSlot}
      />
      <BookingCalendarMobile
        orgSlug={props.orgSlug}
        query={props.query}
        timeZone={props.timeZone}
        resources={props.resources}
        bookings={props.bookings}
        unnumberedLabel={props.labels.unnumbered}
        minutesSuffix={props.labels.minutesSuffix}
        addSlotLabel={props.labels.addSlot}
        canCreate={props.canCreate}
        statusLabel={statusLabel}
        onOpenSlot={calendar.openSlot}
      />
      <BookingCalendarSessions
        orgSlug={props.orgSlug}
        businessDate={props.query.date}
        timeZone={props.timeZone}
        locale={props.locale}
        sessions={props.eventSessions}
        offeringNames={new Map(props.offerings.map((o) => [o.offeringId, o.name]))}
      />
    </div>
  );
}

export function BookingCalendarClient(props: BookingCalendarClientProps): ReactElement {
  return (
    <ScreenTextProvider texts={props.texts}>
      <BookingCalendarBody {...props} />
    </ScreenTextProvider>
  );
}
