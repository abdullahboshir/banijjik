import type { ContactId, LocationId, OfferingId, OrganizationId, UserId } from "@banijjik/ids";
import type { BookingHoldBody } from "@banijjik/validation/booking";
import type { BookingKind, Money } from "@banijjik/contracts/booking";
import { resolveBookingContactId } from "./booking-slot-selection.js";
import type { HoldBookingDependencies } from "./use-cases/hold-booking.use-case.js";
import { quoteDepositForBooking } from "./staff-booking-quote.js";
import type { PriceQuoterPort } from "./ports/booking-context-ports.js";
import { loadActiveOffering } from "./staff-booking-quote.js";
import { reserveHoldSlot } from "./hold-booking-reserve.js";

function computeHoldExpiry(now: Date, holdMinutes: number): Date {
  return new Date(now.getTime() + holdMinutes * 60_000);
}

export async function prepareHoldBooking(input: {
  dependencies: HoldBookingDependencies;
  organizationId: OrganizationId;
  actorUserId: UserId | null;
  allowedLocationIds: readonly string[] | "ALL";
  body: BookingHoldBody;
}): Promise<{
  locationId: LocationId;
  offeringId: OfferingId;
  contactId: ContactId;
  kind: BookingKind;
  quantity: number;
  startsAt: Date;
  endsAt: Date;
  blockedEndsAt: Date;
  depositRequired: Money;
  holdExpiresAt: Date;
  line: NonNullable<Awaited<ReturnType<PriceQuoterPort["quote"]>>["lines"][0]>;
  resourceId: import("@banijjik/ids").ResourceId;
  resourceCapacity: number;
  memberId: import("@banijjik/ids").MemberId | null;
  now: Date;
}> {
  const slot = await reserveHoldSlot(input);
  const offering = await loadActiveOffering({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    offeringId: slot.offeringId,
    variantId: input.body.variantId,
    locationId: slot.locationId,
  });
  const settings = await input.dependencies.settings.read(input.organizationId);
  const contactId = await resolveBookingContactId(input.dependencies.contacts, input);
  const { line, depositRequired } = await quoteDepositForBooking({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    locationId: input.body.locationId,
    offeringId: input.body.offeringId,
    variantId: input.body.variantId,
    quantity: slot.quantity,
    offering,
  });
  const now = input.dependencies.clock.now();
  return {
    ...slot,
    contactId,
    depositRequired,
    holdExpiresAt: computeHoldExpiry(now, settings.holdMinutes),
    line,
    now,
  };
}
