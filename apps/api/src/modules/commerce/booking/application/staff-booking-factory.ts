import { BOOKING_STATUS, type BookingKind } from "@banijjik/contracts/booking";
import type {
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
  contactId: import("@banijjik/ids").ContactId;
  offeringId: OfferingId;
  variantId: string;
  kind?: BookingKind;
  quantity?: number;
  depositRequired: Money;
  startsAt: Date;
  endsAt: Date;
  blockedEndsAt: Date;
  resourceId: ResourceId;
  memberId: MemberId | null;
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
    resourceIds: [input.resourceId],
    providerMemberId: input.memberId,
    price: input.price,
    status: input.status,
    bookingNumber: input.bookingNumber,
    note: input.note,
    now: input.now,
    actorUserId: input.actorUserId,
  });
}
