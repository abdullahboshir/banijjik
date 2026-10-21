"use client";

import type { BookingResponse, ResourceResponse } from "@banijjik/contracts/booking";
import type { ReactElement } from "react";
import { BookingCalendarResourceColumn } from "./booking-calendar-resource-column";
import type { BookingCalendarQuery } from "./booking-query";

export function BookingCalendarDesktop(props: {
  orgSlug: string;
  query: BookingCalendarQuery;
  timeZone: string;
  slotStepMinutes: number;
  resources: readonly ResourceResponse[];
  bookings: readonly BookingResponse[];
  gridHeight: number;
  startMinutes: number;
  unnumberedLabel: string;
  canCreate: boolean;
  statusLabel: (status: BookingResponse["status"]) => string;
  onOpenSlot: (resourceId: string, minutesFromGridStart: number) => void;
}): ReactElement {
  return (
    <div
      className="hidden gap-3 md:grid"
      style={{
        gridTemplateColumns: `repeat(${Math.max(props.resources.length, 1)}, minmax(0, 1fr))`,
      }}
    >
      {props.resources.map((resource) => (
        <BookingCalendarResourceColumn
          key={resource.resourceId}
          orgSlug={props.orgSlug}
          resource={resource}
          bookings={props.bookings}
          query={props.query}
          timeZone={props.timeZone}
          startMinutes={props.startMinutes}
          slotStepMinutes={props.slotStepMinutes}
          gridHeight={props.gridHeight}
          unnumberedLabel={props.unnumberedLabel}
          canCreate={props.canCreate}
          statusLabel={props.statusLabel}
          onOpenSlot={props.onOpenSlot}
        />
      ))}
    </div>
  );
}
