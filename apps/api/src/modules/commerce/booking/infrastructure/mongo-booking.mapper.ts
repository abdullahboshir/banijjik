import {
  asId,
  type BookingId,
  type ContactId,
  type LocationId,
  type MemberId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
  type UserId,
} from "@banijjik/ids";
import type { ScheduleRange } from "@banijjik/contracts/booking";
import { Booking } from "../domain/booking.entity.js";
import { Resource } from "../domain/resource.entity.js";
import type { BookingDocument, ResourceDocument } from "./booking.schema.js";

export function toResource(row: ResourceDocument): Resource {
  return Resource.rehydrate({
    resourceId: asId<ResourceId>(row.resourceId),
    organizationId: asId<OrganizationId>(row.organizationId),
    locationId: asId<LocationId>(row.locationId),
    resourceTypeKey: row.resourceTypeKey,
    name: row.name,
    memberId: row.memberId === null ? null : asId<MemberId>(row.memberId),
    capacity: row.capacity,
    weeklySchedule: row.weeklySchedule as readonly ScheduleRange[],
    offeringIds: row.offeringIds.map((id) => asId<OfferingId>(id)),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId === null ? null : asId<UserId>(row.createdByUserId),
    updatedByUserId: row.updatedByUserId === null ? null : asId<UserId>(row.updatedByUserId),
  });
}

export function toBooking(row: BookingDocument): Booking {
  return Booking.rehydrate({
    bookingId: asId<BookingId>(row.bookingId),
    organizationId: asId<OrganizationId>(row.organizationId),
    bookingNumber: row.bookingNumber,
    locationId: asId<LocationId>(row.locationId),
    contactId: asId<ContactId>(row.contactId),
    offeringId: asId<OfferingId>(row.offeringId),
    variantId: row.variantId,
    kind: row.kind,
    depositRequired: {
      amount: row.depositRequired.amount,
      currency: row.depositRequired.currency as "BDT",
    },
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    blockedEndsAt: row.blockedEndsAt,
    resourceIds: row.resourceIds.map((id) => asId<ResourceId>(id)),
    providerMemberId: row.providerMemberId === null ? null : asId<MemberId>(row.providerMemberId),
    quantity: row.quantity,
    price: {
      unitPrice: row.price.unitPrice as Booking["price"]["unitPrice"],
      total: row.price.total as Booking["price"]["total"],
      tax: row.price.tax as Booking["price"]["tax"],
      currency: row.price.currency as Booking["price"]["currency"],
    },
    status: row.status,
    source: row.source,
    note: row.note,
    holdExpiresAt: row.holdExpiresAt,
    history: row.history,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId === null ? null : asId<UserId>(row.createdByUserId),
    updatedByUserId: row.updatedByUserId === null ? null : asId<UserId>(row.updatedByUserId),
  });
}

export function bookingDocument(booking: Booking): BookingDocument {
  const props = booking.toProps();
  return {
    bookingId: props.bookingId,
    organizationId: props.organizationId,
    bookingNumber: props.bookingNumber,
    locationId: props.locationId,
    contactId: props.contactId,
    offeringId: props.offeringId,
    variantId: props.variantId,
    kind: props.kind,
    depositRequired: props.depositRequired,
    startsAt: props.startsAt,
    endsAt: props.endsAt,
    blockedEndsAt: props.blockedEndsAt,
    resourceIds: [...props.resourceIds],
    providerMemberId: props.providerMemberId,
    quantity: props.quantity,
    price: props.price,
    status: props.status,
    source: props.source,
    note: props.note,
    holdExpiresAt: props.holdExpiresAt,
    history: [...props.history],
    version: props.version,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
    createdByUserId: props.createdByUserId,
    updatedByUserId: props.updatedByUserId,
  };
}
