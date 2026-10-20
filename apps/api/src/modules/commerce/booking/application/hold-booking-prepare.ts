import type { ContactId, LocationId, OfferingId, OrganizationId, UserId } from "@banijjik/ids";
import type { BookingHoldBody } from "@banijjik/validation/booking";
import type { Money } from "@banijjik/contracts/booking";
import { resolveBookingContactId } from "./booking-slot-selection.js";
import type { HoldBookingDependencies } from "./use-cases/hold-booking.use-case.js";
import { quoteDepositForBooking } from "./staff-booking-quote.js";
import type { PriceQuoterPort } from "./ports/booking-context-ports.js";
import { loadActiveServiceOffering } from "./staff-booking-quote.js";
import { reserveHoldSlot } from "./hold-booking-reserve.js";

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
  const offering = await loadActiveServiceOffering({
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
    offering,
  });
  const now = input.dependencies.clock.now();
  const holdExpiresAt = new Date(now.getTime() + settings.holdMinutes * 60_000);
  return {
    locationId: slot.locationId,
    offeringId: slot.offeringId,
    contactId,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    blockedEndsAt: slot.blockedEndsAt,
    depositRequired,
    holdExpiresAt,
    line,
    resourceId: slot.resourceId,
    resourceCapacity: slot.resourceCapacity,
    memberId: slot.memberId,
    now,
  };
}
