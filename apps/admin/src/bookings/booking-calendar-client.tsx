"use client";

import type { ReactElement } from "react";
import { BookingCalendarDesktop } from "./booking-calendar-desktop";
import { BookingCalendarMobile } from "./booking-calendar-mobile";
import { BookingCalendarToolbar } from "./booking-calendar-toolbar";
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
  canCreate: boolean;
  labels: {
    loading: string;
    addBooking: string;
    addSlot: string;
    unnumbered: string;
    minutesSuffix: string;
    sheet: NewBookingSheetLabels;
  };
  statusLabel: (status: BookingResponse["status"]) => string;
}

export function BookingCalendarClient(props: BookingCalendarClientProps): ReactElement {
  const calendar = useBookingCalendarState(props);

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
        seed={calendar.bookingSeed}
        sheetLabels={props.labels.sheet}
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
        statusLabel={props.statusLabel}
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
        statusLabel={props.statusLabel}
        onOpenSlot={calendar.openSlot}
      />
    </div>
  );
}
