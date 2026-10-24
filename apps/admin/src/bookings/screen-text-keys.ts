/** Every screen key the rental, event and session client components read (see screen-text.tsx). */
export const BOOKING_MODE_TEXT_KEYS = [
  "bookings.sheet.price",
  "bookings.sheet.priceLoading",
  "bookings.sheet.units",
  "bookings.sheet.unitsMin",
  "bookings.sheet.unitsRange",
  "bookings.sheet.rentalLegend",
  "bookings.sheet.rentalStart",
  "bookings.sheet.rentalResource",
  "bookings.sheet.anyResource",
  "bookings.sheet.rentalEnds",
  "bookings.sheet.sessionLegend",
  "bookings.sheet.loadingSessions",
  "bookings.sheet.noSessions",
  "bookings.sheet.seatsLeft",
  "bookings.sheet.seats",
  "catalog.details.rateUnit.HOUR",
  "catalog.details.rateUnit.DAY",
  "catalog.details.rateUnit.NIGHT",
  "bookings.calendar.sessions",
  "bookings.calendar.rentalUntil",
  "bookings.eventSessions.seatsSold",
] as const;

export const EVENT_SESSION_TEXT_KEYS = [
  "bookings.eventSessions.createTitle",
  "bookings.eventSessions.editTitle",
  "bookings.eventSessions.offering",
  "bookings.eventSessions.variant",
  "bookings.eventSessions.startsAt",
  "bookings.eventSessions.endsAt",
  "bookings.eventSessions.capacity",
  "bookings.eventSessions.timeLocked",
  "bookings.eventSessions.cancelTitle",
  "bookings.eventSessions.cancelDescription",
  "bookings.eventSessions.cancelConfirm",
  "bookings.eventSessions.cancelKeep",
  "bookings.form.location",
  "bookings.form.close",
  "bookings.form.save",
  "bookings.form.conflict",
  "bookings.form.reload",
] as const;

/** The texts of the given keys from a server translator; placeholders stay for the browser to fill. */
export function pickScreenTexts(
  t: (key: string) => string,
  keys: readonly string[],
): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, t(key)]));
}
