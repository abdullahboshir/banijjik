import { BOOKING_SOURCE } from "@banijjik/contracts/booking";
import type { OrganizationId, ResourceId, UserId } from "@banijjik/ids";
import type { BookingHoldBody } from "@banijjik/validation/booking";
import { Booking } from "../domain/booking.entity.js";
import type { HoldBookingDependencies } from "./use-cases/hold-booking.use-case.js";
import { prepareHoldBooking } from "./hold-booking-prepare.js";

export async function assembleHoldBooking(input: {
  dependencies: HoldBookingDependencies;
  organizationId: OrganizationId;
  actorUserId: UserId | null;
  allowedLocationIds: readonly string[] | "ALL";
  body: BookingHoldBody;
  source: typeof BOOKING_SOURCE.STOREFRONT;
}): Promise<{
  booking: Booking;
  resourceId: ResourceId;
  resourceCapacity: number;
  startsAt: Date;
  blockedEndsAt: Date;
}> {
  const prepared = await prepareHoldBooking(input);
  const booking = Booking.createHold({
    organizationId: input.organizationId,
    locationId: prepared.locationId,
    contactId: prepared.contactId,
    offeringId: prepared.offeringId,
    variantId: input.body.variantId,
    depositRequired: prepared.depositRequired,
    startsAt: prepared.startsAt,
    endsAt: prepared.endsAt,
    blockedEndsAt: prepared.blockedEndsAt,
    resourceIds: [prepared.resourceId],
    providerMemberId: prepared.memberId,
    price: {
      unitPrice: prepared.line.unitPrice,
      total: prepared.line.lineNetTotal,
      tax: prepared.line.lineTax,
      currency: prepared.line.unitPrice.currency,
    },
    holdExpiresAt: prepared.holdExpiresAt,
    note: input.body.note ?? null,
    source: input.source,
    now: prepared.now,
    actorUserId: input.actorUserId,
  });
  return {
    booking,
    resourceId: prepared.resourceId,
    resourceCapacity: prepared.resourceCapacity,
    startsAt: prepared.startsAt,
    blockedEndsAt: prepared.blockedEndsAt,
  };
}
