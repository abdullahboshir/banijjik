import { BOOKING_STATUS, type BookingStatus } from "@banijjik/contracts/booking";
import { invalidTransition } from "./errors.js";

export type BookingTransitionAction =
  "confirm" | "request" | "reschedule" | "checkIn" | "complete" | "cancel" | "noShow" | "expire";

const ALLOWED: Readonly<Record<BookingTransitionAction, readonly BookingStatus[]>> = {
  confirm: [BOOKING_STATUS.REQUESTED],
  request: [BOOKING_STATUS.HELD],
  reschedule: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN],
  checkIn: [BOOKING_STATUS.CONFIRMED],
  complete: [BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.CONFIRMED],
  cancel: [
    BOOKING_STATUS.HELD,
    BOOKING_STATUS.REQUESTED,
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CHECKED_IN,
  ],
  noShow: [BOOKING_STATUS.CONFIRMED],
  expire: [BOOKING_STATUS.HELD],
};

export function assertTransitionAllowed(
  current: BookingStatus,
  action: BookingTransitionAction,
): void {
  if (!ALLOWED[action].includes(current)) throw invalidTransition(current);
}

export function targetStatusFor(action: BookingTransitionAction): BookingStatus {
  switch (action) {
    case "confirm":
      return BOOKING_STATUS.CONFIRMED;
    case "request":
      return BOOKING_STATUS.REQUESTED;
    case "reschedule":
      return BOOKING_STATUS.CONFIRMED;
    case "checkIn":
      return BOOKING_STATUS.CHECKED_IN;
    case "complete":
      return BOOKING_STATUS.COMPLETED;
    case "cancel":
      return BOOKING_STATUS.CANCELLED;
    case "noShow":
      return BOOKING_STATUS.NO_SHOW;
    case "expire":
      return BOOKING_STATUS.EXPIRED;
    default: {
      const never: never = action;
      throw new Error(String(never));
    }
  }
}

/** Whether a status still holds resource capacity (11 §5.1). */
export function statusHoldsCapacity(status: BookingStatus): boolean {
  return (
    status === BOOKING_STATUS.HELD ||
    status === BOOKING_STATUS.REQUESTED ||
    status === BOOKING_STATUS.CONFIRMED ||
    status === BOOKING_STATUS.CHECKED_IN
  );
}
