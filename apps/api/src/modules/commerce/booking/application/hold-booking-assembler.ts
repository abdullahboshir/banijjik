import { BOOKING_SOURCE } from "@banijjik/contracts/booking";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { BookingHoldBody } from "@banijjik/validation/booking";
import { Booking } from "../domain/booking.entity.js";
import type { HoldBookingDependencies } from "./use-cases/hold-booking.use-case.js";
import { prepareHoldBooking } from "./hold-booking-prepare.js";
import type { HoldCapacity } from "./hold-booking-reserve.js";

export async function assembleHoldBooking(input: {
  dependencies: HoldBookingDependencies;
  organizationId: OrganizationId;
  actorUserId: UserId | null;
  allowedLocationIds: readonly string[] | "ALL";
  body: BookingHoldBody;
  source: typeof BOOKING_SOURCE.STOREFRONT;
  checkoutId?: string | null;
}): Promise<{
  booking: Booking;
  capacity: HoldCapacity;
}> {
  const prepared = await prepareHoldBooking(input);
  const booking = Booking.createHold({
    organizationId: input.organizationId,
    locationId: prepared.locationId,
    contactId: prepared.contactId,
    offeringId: prepared.offeringId,
    variantId: input.body.variantId,
    kind: prepared.kind,
    quantity: prepared.quantity,
    depositRequired: prepared.depositRequired,
    startsAt: prepared.startsAt,
    endsAt: prepared.endsAt,
    blockedEndsAt: prepared.blockedEndsAt,
    resourceIds: prepared.capacity.resourceIds,
    providerMemberId: prepared.capacity.memberId,
    eventSessionId: prepared.capacity.eventSessionId,
    price: {
      unitPrice: prepared.line.unitPrice,
      total: prepared.line.lineNetTotal,
      tax: prepared.line.lineTax,
      currency: prepared.line.unitPrice.currency,
    },
    holdExpiresAt: prepared.holdExpiresAt,
    checkoutId: input.checkoutId ?? null,
    note: input.body.note ?? null,
    source: input.source,
    now: prepared.now,
    actorUserId: input.actorUserId,
  });
  return { booking, capacity: prepared.capacity };
}
