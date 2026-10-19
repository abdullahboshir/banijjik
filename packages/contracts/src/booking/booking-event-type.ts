/**
 * Booking events accounting consumes (card 3.8c). Card 3.6 publishes these; payloads are ids only.
 * Whichever branch merges second rebases (lead clarification for ADR-124).
 */
export const BOOKING_EVENT_TYPE = Object.freeze({
  BOOKING_COMPLETED: "booking.booking.completed",
  BOOKING_CANCELLED: "booking.booking.cancelled",
} as const);

export type BookingEventType = (typeof BOOKING_EVENT_TYPE)[keyof typeof BOOKING_EVENT_TYPE];

export interface BookingEventPayload {
  readonly bookingId: string;
}
