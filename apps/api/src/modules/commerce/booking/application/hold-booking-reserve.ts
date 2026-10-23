import { OFFERING_KIND } from "@banijjik/contracts";
import type { BookingKind } from "@banijjik/contracts/booking";
import { BOOKING_KIND } from "@banijjik/contracts/booking";
import {
  asId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
} from "@banijjik/ids";
import type { BookingHoldBody } from "@banijjik/validation/booking";
import { slotBounds } from "../domain/availability.js";
import { computeRentalTime } from "../domain/rental-time.js";
import { reserveResourceForSlot } from "./booking-slot-selection.js";
import type { HoldBookingDependencies } from "./use-cases/hold-booking.use-case.js";
import { loadActiveOffering } from "./staff-booking-quote.js";

import type { OfferingBookingView } from "./ports/booking-context-ports.js";

function resolveHoldBounds(input: {
  readonly offering: OfferingBookingView;
  readonly requestedStartsAt: Date;
  readonly requestedQuantity: number | undefined;
  readonly timeZone: string;
}) {
  if (input.offering.kind === OFFERING_KIND.RENTAL) {
    const rentalTime = computeRentalTime({
      startsAt: input.requestedStartsAt,
      quantity: input.requestedQuantity,
      rental: input.offering.rental,
      timeZone: input.timeZone,
    });
    return {
      kind: BOOKING_KIND.RENTAL,
      isRental: true,
      resourceTypeKeys: input.offering.rental.resourceTypeKeys,
      startsAt: rentalTime.startsAt,
      endsAt: rentalTime.endsAt,
      blockedEndsAt: rentalTime.blockedEndsAt,
      quantity: rentalTime.quantity,
    };
  }
  const bounds = slotBounds(
    input.requestedStartsAt,
    input.offering.durationMinutes,
    input.offering.service.bufferAfterMinutes,
  );
  return {
    kind: BOOKING_KIND.SERVICE,
    isRental: false,
    resourceTypeKeys: input.offering.service.resourceTypeKeys,
    startsAt: input.requestedStartsAt,
    endsAt: bounds.endsAt,
    blockedEndsAt: bounds.blockedEndsAt,
    quantity: 1,
  };
}

export async function reserveHoldSlot(input: {
  dependencies: HoldBookingDependencies;
  organizationId: OrganizationId;
  body: BookingHoldBody;
}): Promise<{
  locationId: LocationId;
  offeringId: OfferingId;
  kind: BookingKind;
  quantity: number;
  startsAt: Date;
  endsAt: Date;
  blockedEndsAt: Date;
  resourceId: ResourceId;
  resourceCapacity: number;
  memberId: import("@banijjik/ids").MemberId | null;
}> {
  const locationId = asId<LocationId>(input.body.locationId);
  const offeringId = asId<OfferingId>(input.body.offeringId);
  const requestedStartsAt = new Date(input.body.startsAt);
  const offering = await loadActiveOffering({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    offeringId,
    variantId: input.body.variantId,
    locationId,
  });
  const timeZone = await input.dependencies.timeZone.read(input.organizationId);
  const bounds = resolveHoldBounds({
    offering,
    requestedStartsAt,
    requestedQuantity: input.body.quantity,
    timeZone,
  });

  const preferred =
    input.body.resourceId === undefined ? undefined : asId<ResourceId>(input.body.resourceId);
  const resource = await reserveResourceForSlot({
    resources: input.dependencies.resources,
    slots: input.dependencies.slots,
    organizationId: input.organizationId,
    locationId,
    offeringId,
    startsAt: bounds.startsAt,
    blockedEndsAt: bounds.blockedEndsAt,
    resourceTypeKeys: bounds.resourceTypeKeys,
    isRental: bounds.isRental,
    ...(preferred === undefined ? {} : { preferredResourceId: preferred }),
    timeZone,
    timeOff: input.dependencies.timeOff,
  });
  return {
    locationId,
    offeringId,
    ...bounds,
    resourceId: resource.resourceId,
    resourceCapacity: resource.capacity,
    memberId: resource.memberId,
  };
}
