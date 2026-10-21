import type { BookingStatus } from "@banijjik/contracts/booking";
import type { Translator } from "@banijjik/i18n";

export function bookingStatusLabelOf(status: BookingStatus, t: Translator["t"]): string {
  return t(`bookings.status.${status}`);
}

export function bookingActionLabelOf(action: string, t: Translator["t"]): string {
  return t(`bookings.action.${action}`);
}
