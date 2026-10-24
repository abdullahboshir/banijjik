import { BOOKING_STATUS, type BookingKind } from "@banijjik/contracts/booking";
import type {
  ContactId,
  EventSessionId,
  LocationId,
  MemberId,
  OfferingId,
  OrganizationId,
  ResourceId,
  UserId,
} from "@banijjik/ids";
import type { Money } from "@banijjik/contracts/booking";
import { Booking } from "../domain/booking.entity.js";

export function createStaffBookingFromParts(input: {
  organizationId: OrganizationId;
  locationId: LocationId;
  contactId: ContactId;
  offeringId: OfferingId;
  variantId: string;
  kind?: BookingKind;
  quantity?: number;
  depositRequired: Money;
  startsAt: Date;
  endsAt: Date;
  blockedEndsAt: Date;
  resourceIds: readonly ResourceId[];
  providerMemberId: MemberId | null;
  eventSessionId?: EventSessionId | undefined;
  price: Booking["price"];
  status: typeof BOOKING_STATUS.REQUESTED | typeof BOOKING_STATUS.CONFIRMED;
  bookingNumber: string | null;
  note: string | null;
  now: Date;
  actorUserId: UserId | null;
}): Booking {
  return Booking.createStaff({
    organizationId: input.organizationId,
    locationId: input.locationId,
    contactId: input.contactId,
    offeringId: input.offeringId,
    variantId: input.variantId,
    kind: input.kind,
    quantity: input.quantity,
    depositRequired: input.depositRequired,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    blockedEndsAt: input.blockedEndsAt,
    resourceIds: input.resourceIds,
    providerMemberId: input.providerMemberId,
    price: input.price,
    status: input.status,
    bookingNumber: input.bookingNumber,
    note: input.note,
    ...(input.eventSessionId === undefined ? {} : { eventSessionId: input.eventSessionId }),
    now: input.now,
    actorUserId: input.actorUserId,
  });
}
