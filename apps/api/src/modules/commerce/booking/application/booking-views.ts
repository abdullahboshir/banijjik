import type {
  BookingResponse,
  ResourceResponse,
  ResourceTimeOffResponse,
} from "@banijjik/contracts/booking";
import type { Booking } from "../domain/booking.entity.js";
import type { Resource } from "../domain/resource.entity.js";
import type { ResourceTimeOffRecord } from "./ports/booking-repositories.js";

export function toResourceResponse(resource: Resource): ResourceResponse {
  const props = resource.toProps();
  return {
    resourceId: props.resourceId,
    locationId: props.locationId,
    resourceTypeKey: props.resourceTypeKey,
    name: props.name,
    memberId: props.memberId,
    capacity: props.capacity,
    weeklySchedule: props.weeklySchedule,
    offeringIds: props.offeringIds,
    status: props.status,
    version: props.version,
    createdAt: props.createdAt.toISOString(),
    updatedAt: props.updatedAt.toISOString(),
  };
}

export function toResourceTimeOffResponse(row: ResourceTimeOffRecord): ResourceTimeOffResponse {
  return {
    resourceTimeOffId: row.resourceTimeOffId,
    resourceId: row.resourceId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toBookingResponse(booking: Booking): BookingResponse {
  const props = booking.toProps();
  return {
    bookingId: props.bookingId,
    bookingNumber: props.bookingNumber,
    locationId: props.locationId,
    contactId: props.contactId,
    offeringId: props.offeringId,
    variantId: props.variantId,
    kind: props.kind,
    depositRequired: props.depositRequired,
    startsAt: props.startsAt.toISOString(),
    endsAt: props.endsAt.toISOString(),
    resourceIds: props.resourceIds,
    providerMemberId: props.providerMemberId,
    quantity: props.quantity,
    price: props.price,
    status: props.status,
    source: props.source,
    note: props.note,
    holdExpiresAt: props.holdExpiresAt?.toISOString() ?? null,
    history: props.history,
    version: props.version,
    createdAt: props.createdAt.toISOString(),
    updatedAt: props.updatedAt.toISOString(),
  };
}
