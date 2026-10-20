import {
  asId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
} from "@banijjik/ids";
import type { BookingHoldBody } from "@banijjik/validation/booking";
import { slotBounds } from "../domain/availability.js";
import { reserveResourceForSlot } from "./booking-slot-selection.js";
import type { HoldBookingDependencies } from "./use-cases/hold-booking.use-case.js";
import { loadActiveServiceOffering } from "./staff-booking-quote.js";

export async function reserveHoldSlot(input: {
  dependencies: HoldBookingDependencies;
  organizationId: OrganizationId;
  body: BookingHoldBody;
}): Promise<{
  locationId: LocationId;
  offeringId: OfferingId;
  startsAt: Date;
  endsAt: Date;
  blockedEndsAt: Date;
  resourceId: ResourceId;
  resourceCapacity: number;
  memberId: import("@banijjik/ids").MemberId | null;
}> {
  const locationId = asId<LocationId>(input.body.locationId);
  const offeringId = asId<OfferingId>(input.body.offeringId);
  const startsAt = new Date(input.body.startsAt);
  const offering = await loadActiveServiceOffering({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    offeringId,
    variantId: input.body.variantId,
    locationId,
  });
  const { endsAt, blockedEndsAt } = slotBounds(
    startsAt,
    offering.durationMinutes,
    offering.service.bufferAfterMinutes,
  );
  const timeZone = await input.dependencies.timeZone.read(input.organizationId);
  const preferred =
    input.body.resourceId === undefined ? undefined : asId<ResourceId>(input.body.resourceId);
  const resource = await reserveResourceForSlot({
    resources: input.dependencies.resources,
    slots: input.dependencies.slots,
    organizationId: input.organizationId,
    locationId,
    offeringId,
    startsAt,
    blockedEndsAt,
    ...(preferred === undefined ? {} : { preferredResourceId: preferred }),
    timeZone,
    timeOff: input.dependencies.timeOff,
  });
  return {
    locationId,
    offeringId,
    startsAt,
    endsAt,
    blockedEndsAt,
    resourceId: resource.resourceId,
    resourceCapacity: resource.capacity,
    memberId: resource.memberId,
  };
}
