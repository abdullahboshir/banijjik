"use client";

import type { BookingResponse, ResourceResponse } from "@banijjik/contracts/booking";
import Link from "next/link";
import type { ReactElement } from "react";
import {
  bookingBlockOf,
  CALENDAR_SLOT_HEIGHT_PX,
  type CalendarBookingBlock,
} from "./booking-calendar-layout";
import type { BookingCalendarQuery } from "./booking-query";

/** A rental bar is square where it runs on into the neighbouring day, so the person sees it continue. */
function blockShapeClass(block: CalendarBookingBlock): string {
  const top = block.continuesBefore ? "rounded-t-none" : "rounded-t-sm";
  const bottom = block.continuesAfter ? "rounded-b-none" : "rounded-b-sm";
  const rentalEdge = block.kind === "RENTAL" ? "border-s-4 border-accent" : "";
  return `${top} ${bottom} ${rentalEdge}`;
}

export function BookingCalendarResourceColumn(props: {
  orgSlug: string;
  resource: ResourceResponse;
  bookings: readonly BookingResponse[];
  query: BookingCalendarQuery;
  timeZone: string;
  startMinutes: number;
  slotStepMinutes: number;
  gridHeight: number;
  unnumberedLabel: string;
  canCreate: boolean;
  statusLabel: (status: BookingResponse["status"]) => string;
  onOpenSlot: (resourceId: string, minutesFromGridStart: number) => void;
}): ReactElement {
  const blocks = props.bookings
    .filter((booking) => booking.resourceIds.includes(props.resource.resourceId))
    .map((booking) =>
      bookingBlockOf({
        booking,
        label: booking.bookingNumber ?? props.unnumberedLabel,
        businessDate: props.query.date,
        timeZone: props.timeZone,
        startMinutes: props.startMinutes,
        endMinutes:
          props.startMinutes + (props.gridHeight / CALENDAR_SLOT_HEIGHT_PX) * props.slotStepMinutes,
        slotStepMinutes: props.slotStepMinutes,
      }),
    );
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className="text-small font-semibold text-primary">{props.resource.name}</h2>
      <div
        className="relative rounded-md border border-default bg-surface"
        style={{ height: props.gridHeight }}
        role="presentation"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const y = event.clientY - rect.top;
          const minutesFromGridStart = (y / CALENDAR_SLOT_HEIGHT_PX) * props.slotStepMinutes;
          if (props.canCreate) props.onOpenSlot(props.resource.resourceId, minutesFromGridStart);
        }}
      >
        {blocks.map((block) => (
          <Link
            key={block.bookingId}
            href={`/${props.orgSlug}/bookings/${block.bookingId}`}
            className={`absolute inset-x-1 overflow-hidden bg-accent-subtle px-2 py-1 text-small text-primary ${blockShapeClass(block)}`}
            style={{ top: block.topPx, height: block.heightPx }}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="block truncate">{block.label}</span>
            <span className="text-secondary">{props.statusLabel(block.status)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
