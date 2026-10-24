import type { ResourceResponse } from "@banijjik/contracts/booking";
import type { Money, OfferingResponse, RentalDetails } from "@banijjik/contracts/catalog";
import type { EventSessionView } from "./event-session-api";

/** How the sheet picks the time: a free slot (services), a start plus units (rentals) or a session (events). */
export type NewBookingMode = "SLOT" | "RENTAL" | "EVENT";

export function bookingModeOf(offering: OfferingResponse | undefined): NewBookingMode {
  if (offering?.kind === "RENTAL") return "RENTAL";
  if (offering?.kind === "EVENT") return "EVENT";
  return "SLOT";
}

export function rentalDetailsOf(offering: OfferingResponse | undefined): RentalDetails | undefined {
  return offering?.kind === "RENTAL" ? (offering.kindDetails as RentalDetails) : undefined;
}

/** The resources a rental may use: active ones of the types the offering lists. */
export function rentalResourcesOf(
  resources: readonly ResourceResponse[],
  rental: RentalDetails | undefined,
): ResourceResponse[] {
  if (rental === undefined) return [];
  return resources.filter(
    (resource) =>
      resource.status === "ACTIVE" && rental.resourceTypeKeys.includes(resource.resourceTypeKey),
  );
}

/** Sessions still on sale for the chosen variant that start in the future. */
export function sellableSessionsOf(
  sessions: readonly EventSessionView[],
  input: { variantId: string; now: Date },
): EventSessionView[] {
  return sessions.filter(
    (session) =>
      session.status === "SCHEDULED" &&
      session.variantId === input.variantId &&
      Date.parse(session.startsAt) > input.now.getTime(),
  );
}

export function seatsLeftOf(session: EventSessionView): number {
  return Math.max(session.capacity - session.seatsSold, 0);
}

export function isPositiveWholeNumber(text: string): boolean {
  const value = Number(text);
  return text.trim() !== "" && Number.isInteger(value) && value >= 1;
}

/** What the slot step needs besides the form: the offering mode and the data that mode reads. */
export interface NewBookingModeData {
  mode: NewBookingMode;
  rental: RentalDetails | undefined;
  rentalResources: readonly ResourceResponse[];
  sessions: readonly EventSessionView[];
  sessionsLoading: boolean;
  total: Money | null;
  quoteLoading: boolean;
}
