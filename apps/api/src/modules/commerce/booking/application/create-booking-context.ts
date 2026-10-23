import { BOOKING_STATUS } from "@banijjik/contracts/booking";
import type { OrganizationId, ResourceId, UserId } from "@banijjik/ids";
import type { BookingCreateBody } from "@banijjik/validation/booking";
import { Booking } from "../domain/booking.entity.js";
import type { CreateBookingDependencies } from "./use-cases/create-booking.use-case.js";
import { createStaffBookingFromParts } from "./staff-booking-factory.js";
import { prepareStaffBooking } from "./staff-booking-prepare.js";

export async function buildStaffBookingForSlot(input: {
  dependencies: CreateBookingDependencies;
  organizationId: OrganizationId;
  actorUserId: UserId | null;
  allowedLocationIds: readonly string[] | "ALL";
  body: BookingCreateBody;
  resource: {
    resourceId: ResourceId;
    memberId: import("@banijjik/ids").MemberId | null;
    capacity: number;
  };
}): Promise<{
  booking: Booking;
  status: typeof BOOKING_STATUS.REQUESTED | typeof BOOKING_STATUS.CONFIRMED;
  resourceId: ResourceId;
  resourceCapacity: number;
}> {
  const prepared = await prepareStaffBooking(input);
  const booking = createStaffBookingFromParts({
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
    resourceId: input.resource.resourceId,
    memberId: input.resource.memberId,
    price: {
      unitPrice: prepared.line.unitPrice,
      total: prepared.line.lineNetTotal,
      tax: prepared.line.lineTax,
      currency: prepared.line.unitPrice.currency,
    },
    status: prepared.status,
    bookingNumber: prepared.bookingNumber,
    note: input.body.note ?? null,
    now: prepared.now,
    actorUserId: input.actorUserId,
  });
  return {
    booking,
    status: prepared.status,
    resourceId: input.resource.resourceId,
    resourceCapacity: input.resource.capacity,
  };
}
