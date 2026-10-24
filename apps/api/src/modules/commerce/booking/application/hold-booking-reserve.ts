import { OFFERING_KIND } from "@banijjik/contracts";
import type { BookingKind } from "@banijjik/contracts/booking";
import { BOOKING_KIND } from "@banijjik/contracts/booking";
import {
  asId,
  type EventSessionId,
  type LocationId,
  type MemberId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
} from "@banijjik/ids";
import type { BookingHoldBody } from "@banijjik/validation/booking";
import { slotBounds } from "../domain/availability.js";
import { computeRentalTime } from "../domain/rental-time.js";
import { reserveResourceForSlot } from "./booking-slot-selection.js";
import {
  eventBookingBounds,
  eventSeatCount,
  rejectEventSessionOn,
  requireEventSessionId,
  resolveEventBookingTarget,
  reserveEventSeats,
} from "./event-booking-parts.js";
import type { HoldBookingDependencies } from "./use-cases/hold-booking.use-case.js";
import { loadActiveOffering } from "./staff-booking-quote.js";

import type {
  EventOfferingView,
  RentalOfferingView,
  ServiceOfferingView,
} from "./ports/booking-context-ports.js";

/** What the hold will occupy: slot buckets on a resource, or seats in a session. */
export interface HoldCapacity {
  readonly resourceIds: readonly ResourceId[];
  readonly memberId: MemberId | null;
  readonly eventSessionId?: EventSessionId | undefined;
  readonly reserve: () => Promise<void>;
}

/** The times and quantity a hold books, whichever kind it is. */
interface HeldBounds {
  readonly kind: BookingKind;
  readonly quantity: number;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly blockedEndsAt: Date;
}

function resolveHoldBounds(input: {
  readonly offering: ServiceOfferingView | RentalOfferingView;
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

async function holdEventSeats(input: {
  dependencies: HoldBookingDependencies;
  organizationId: OrganizationId;
  body: BookingHoldBody;
  locationId: LocationId;
  offeringId: OfferingId;
  offering: EventOfferingView;
}): Promise<{ bounds: HeldBounds; capacity: HoldCapacity }> {
  const target = await resolveEventBookingTarget({
    sessions: input.dependencies.sessions,
    offering: input.offering,
    eventSessionId: requireEventSessionId(input.body.eventSessionId),
    offeringId: input.offeringId,
    variantId: input.body.variantId,
    locationId: input.locationId,
    seats: eventSeatCount(input.body.quantity),
    now: input.dependencies.clock.now(),
  });
  return {
    bounds: eventBookingBounds(target),
    capacity: {
      resourceIds: target.resourceIds,
      memberId: null,
      eventSessionId: target.eventSessionId,
      reserve: () =>
        reserveEventSeats({
          sessions: input.dependencies.sessions,
          eventSessionId: target.eventSessionId,
          seats: target.seats,
        }),
    },
  };
}

/** The slot arm: pick a free resource, then the hold takes its buckets inside the transaction. */
async function holdSlotResource(input: {
  dependencies: HoldBookingDependencies;
  organizationId: OrganizationId;
  body: BookingHoldBody;
  locationId: LocationId;
  offeringId: OfferingId;
  offering: ServiceOfferingView | RentalOfferingView;
}): Promise<{ bounds: HeldBounds; capacity: HoldCapacity }> {
  const timeZone = await input.dependencies.timeZone.read(input.organizationId);
  const bounds = resolveHoldBounds({
    offering: input.offering,
    requestedStartsAt: new Date(input.body.startsAt),
    requestedQuantity: input.body.quantity,
    timeZone,
  });
  const preferred =
    input.body.resourceId === undefined ? undefined : asId<ResourceId>(input.body.resourceId);
  const resource = await reserveResourceForSlot({
    resources: input.dependencies.resources,
    slots: input.dependencies.slots,
    organizationId: input.organizationId,
    locationId: input.locationId,
    offeringId: input.offeringId,
    startsAt: bounds.startsAt,
    blockedEndsAt: bounds.blockedEndsAt,
    resourceTypeKeys: bounds.resourceTypeKeys,
    isRental: bounds.isRental,
    ...(preferred === undefined ? {} : { preferredResourceId: preferred }),
    timeZone,
    timeOff: input.dependencies.timeOff,
  });
  return {
    bounds,
    capacity: {
      resourceIds: [resource.resourceId],
      memberId: resource.memberId,
      reserve: () =>
        input.dependencies.slots.takeCapacity({
          organizationId: input.organizationId,
          resourceId: resource.resourceId,
          capacity: resource.capacity,
          startsAt: bounds.startsAt,
          blockedEndsAt: bounds.blockedEndsAt,
        }),
    },
  };
}

export async function reserveHoldSlot(input: {
  dependencies: HoldBookingDependencies;
  organizationId: OrganizationId;
  body: BookingHoldBody;
}): Promise<{
  locationId: LocationId;
  offeringId: OfferingId;
  bounds: HeldBounds;
  capacity: HoldCapacity;
}> {
  const locationId = asId<LocationId>(input.body.locationId);
  const offeringId = asId<OfferingId>(input.body.offeringId);
  const offering = await loadActiveOffering({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    offeringId,
    variantId: input.body.variantId,
    locationId,
  });
  if (offering.kind === OFFERING_KIND.EVENT) {
    const held = await holdEventSeats({ ...input, locationId, offeringId, offering });
    return { locationId, offeringId, ...held };
  }
  rejectEventSessionOn(input.body.eventSessionId);
  const held = await holdSlotResource({ ...input, locationId, offeringId, offering });
  return { locationId, offeringId, ...held };
}
