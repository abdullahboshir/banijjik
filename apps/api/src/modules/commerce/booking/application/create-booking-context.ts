import { BOOKING_STATUS } from "@banijjik/contracts/booking";
import type { EventSessionId, MemberId, OrganizationId, ResourceId, UserId } from "@banijjik/ids";
import type { BookingCreateBody } from "@banijjik/validation/booking";
import { Booking } from "../domain/booking.entity.js";
import type { CreateBookingDependencies } from "./use-cases/create-booking.use-case.js";
import { createStaffBookingFromParts } from "./staff-booking-factory.js";
import { prepareStaffBooking } from "./staff-booking-prepare.js";
import type { EventBookingTarget } from "./event-booking-parts.js";

/** Whatever holds the booked capacity: the staff-picked resource, or the event session. */
export interface BookingHolders {
  readonly resourceIds: readonly ResourceId[];
  readonly providerMemberId: MemberId | null;
  readonly eventSessionId?: EventSessionId | undefined;
}

export async function buildStaffBooking(input: {
  dependencies: CreateBookingDependencies;
  organizationId: OrganizationId;
  actorUserId: UserId | null;
  allowedLocationIds: readonly string[] | "ALL";
  body: BookingCreateBody;
  holders: BookingHolders;
  eventTarget?: EventBookingTarget | undefined;
}): Promise<{
  booking: Booking;
  status: typeof BOOKING_STATUS.REQUESTED | typeof BOOKING_STATUS.CONFIRMED;
}> {
  const prepared = await prepareStaffBooking({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    allowedLocationIds: input.allowedLocationIds,
    body: input.body,
    ...(input.eventTarget === undefined ? {} : { eventTarget: input.eventTarget }),
  });
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
    resourceIds: input.holders.resourceIds,
    providerMemberId: input.holders.providerMemberId,
    ...(input.holders.eventSessionId === undefined
      ? {}
      : { eventSessionId: input.holders.eventSessionId }),
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
  return { booking, status: prepared.status };
}
