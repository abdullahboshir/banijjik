/**
 * Booking domain events. Accounting (3.8c) consumes completed and cancelled with id-only payloads.
 * Verb forms end in ed/d so they pass the contracts event-name pattern (05-CONVENTIONS). Doc 11's
 * `checkedIn` / `noShow` strings become `checkInRecorded` / `noShowMarked` (ADR-122).
 */
export const BOOKING_EVENT_TYPE = Object.freeze({
  BOOKING_HELD: "booking.booking.held",
  BOOKING_REQUESTED: "booking.booking.requested",
  BOOKING_CONFIRMED: "booking.booking.confirmed",
  BOOKING_RESCHEDULED: "booking.booking.rescheduled",
  BOOKING_CHECK_IN_RECORDED: "booking.booking.checkInRecorded",
  BOOKING_COMPLETED: "booking.booking.completed",
  BOOKING_CANCELLED: "booking.booking.cancelled",
  BOOKING_NO_SHOW_MARKED: "booking.booking.noShowMarked",
  BOOKING_EXPIRED: "booking.booking.expired",
  BOOKING_REMINDED: "booking.booking.reminded",
  RESOURCE_CREATED: "booking.resource.created",
  RESOURCE_UPDATED: "booking.resource.updated",
  RESOURCE_DEACTIVATED: "booking.resource.deactivated",
} as const);

export type BookingEventType = (typeof BOOKING_EVENT_TYPE)[keyof typeof BOOKING_EVENT_TYPE];

export interface BookingEventPayload {
  readonly bookingId: string;
}

export interface BookingReminderPayload {
  readonly bookingId: string;
  readonly startsAt: string;
}

export interface ResourceEventPayload {
  readonly resourceId: string;
}
