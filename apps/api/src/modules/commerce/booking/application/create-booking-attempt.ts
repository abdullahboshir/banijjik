import { OFFERING_KIND } from "@banijjik/contracts";
import { BOOKING_STATUS, type BookingResponse } from "@banijjik/contracts/booking";
import {
  asId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
  type UserId,
} from "@banijjik/ids";
import type { BookingCreateBody } from "@banijjik/validation/booking";
import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import { slotBounds } from "../domain/availability.js";
import { computeRentalTime } from "../domain/rental-time.js";
import { bookingRuleError, eventSoldOutError } from "../domain/errors.js";
import { buildStaffBooking } from "./create-booking-context.js";
import { runWithTxnRetry } from "./run-with-txn-retry.js";
import { persistCreatedBooking } from "./create-booking-persist.js";
import { reserveResourceForSlot } from "./booking-slot-selection.js";
import type {
  EventOfferingView,
  RentalOfferingView,
  ServiceOfferingView,
} from "./ports/booking-context-ports.js";
import {
  eventSeatCount,
  requireEventSessionId,
  rejectEventSessionOn,
  resolveEventBookingTarget,
  reserveEventSeats,
} from "./event-booking-parts.js";
import type { CreateBookingDependencies } from "./use-cases/create-booking.use-case.js";

export async function createBookingWithRetries(input: {
  dependencies: CreateBookingDependencies;
  organizationId: OrganizationId;
  actorUserId: UserId | null;
  allowedLocationIds: readonly string[] | "ALL";
  body: BookingCreateBody;
}): Promise<BookingResponse> {
  const locationId = asId<LocationId>(input.body.locationId);
  const offeringId = asId<OfferingId>(input.body.offeringId);
  const offering = await input.dependencies.offerings.readOffering({
    organizationId: input.organizationId,
    offeringId,
    variantId: input.body.variantId,
    locationId,
  });
  if (offering === undefined || !offering.isActive) {
    throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
  }
  if (offering.kind === OFFERING_KIND.EVENT) {
    return createEventBookingWithRetries({ ...input, locationId, offeringId, offering });
  }
  rejectEventSessionOn(input.body.eventSessionId);

  const requestedStartsAt = new Date(input.body.startsAt);
  const timeZone = await input.dependencies.timeZone.read(input.organizationId);
  const bounds = await slotBookingBounds({
    offering,
    requestedStartsAt,
    quantity: input.body.quantity,
    timeZone,
  });

  const preferred =
    input.body.resourceId === undefined ? undefined : asId<ResourceId>(input.body.resourceId);

  return runWithTxnRetry(input.dependencies.unitOfWork, () =>
    tryCreateBookingOnce({
      ...input,
      locationId,
      offeringId,
      preferred,
      ...bounds,
      timeZone,
    }),
  );
}

/** The slot path (service and rental): the rate model sets the times, the kind sets the resources. */
async function slotBookingBounds(input: {
  readonly offering: ServiceOfferingView | RentalOfferingView;
  readonly requestedStartsAt: Date;
  readonly quantity: number | undefined;
  readonly timeZone: string;
}): Promise<{
  startsAt: Date;
  blockedEndsAt: Date;
  resourceTypeKeys: readonly string[];
  isRental: boolean;
}> {
  if (input.offering.kind === OFFERING_KIND.RENTAL) {
    const rentalTime = computeRentalTime({
      startsAt: input.requestedStartsAt,
      quantity: input.quantity,
      rental: input.offering.rental,
      timeZone: input.timeZone,
    });
    return {
      startsAt: rentalTime.startsAt,
      blockedEndsAt: rentalTime.blockedEndsAt,
      resourceTypeKeys: input.offering.rental.resourceTypeKeys,
      isRental: true,
    };
  }
  const bounds = slotBounds(
    input.requestedStartsAt,
    input.offering.durationMinutes,
    input.offering.service.bufferAfterMinutes,
  );
  return {
    startsAt: input.requestedStartsAt,
    blockedEndsAt: bounds.blockedEndsAt,
    resourceTypeKeys: input.offering.service.resourceTypeKeys,
    isRental: false,
  };
}

/** Seats, not slots: the session owns the times and the counter owns the capacity. */
async function createEventBookingWithRetries(input: {
  dependencies: CreateBookingDependencies;
  organizationId: OrganizationId;
  actorUserId: UserId | null;
  allowedLocationIds: readonly string[] | "ALL";
  body: BookingCreateBody;
  locationId: LocationId;
  offeringId: OfferingId;
  offering: EventOfferingView;
}): Promise<BookingResponse> {
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
  return runWithTxnRetry(
    input.dependencies.unitOfWork,
    async () => {
      const built = await buildStaffBooking({
        dependencies: input.dependencies,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        allowedLocationIds: input.allowedLocationIds,
        body: input.body,
        holders: {
          resourceIds: target.resourceIds,
          providerMemberId: null,
          eventSessionId: target.eventSessionId,
        },
        eventTarget: target,
      });
      return persistCreatedBooking({
        dependencies: input.dependencies,
        organizationId: input.organizationId,
        reserveCapacity: () =>
          reserveEventSeats({
            sessions: input.dependencies.sessions,
            eventSessionId: target.eventSessionId,
            seats: target.seats,
          }),
        booking: built.booking,
        status: built.status,
      });
    },
    eventSoldOutError,
  );
}

async function tryCreateBookingOnce(input: {
  dependencies: CreateBookingDependencies;
  organizationId: OrganizationId;
  actorUserId: UserId | null;
  allowedLocationIds: readonly string[] | "ALL";
  body: BookingCreateBody;
  locationId: LocationId;
  offeringId: OfferingId;
  startsAt: Date;
  blockedEndsAt: Date;
  timeZone: string;
  resourceTypeKeys?: readonly string[] | undefined;
  isRental?: boolean | undefined;
  preferred: ResourceId | undefined;
}): Promise<BookingResponse> {
  const resource = await reserveResourceForSlot({
    resources: input.dependencies.resources,
    slots: input.dependencies.slots,
    organizationId: input.organizationId,
    locationId: input.locationId,
    offeringId: input.offeringId,
    startsAt: input.startsAt,
    blockedEndsAt: input.blockedEndsAt,
    resourceTypeKeys: input.resourceTypeKeys,
    isRental: input.isRental,
    ...(input.preferred === undefined ? {} : { preferredResourceId: input.preferred }),
    timeZone: input.timeZone,
    timeOff: input.dependencies.timeOff,
  });
  const built = await buildStaffBooking({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    allowedLocationIds: input.allowedLocationIds,
    body: input.body,
    holders: {
      resourceIds: [resource.resourceId],
      providerMemberId: resource.memberId,
    },
  });
  return await persistCreatedBooking({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    reserveCapacity: () =>
      input.dependencies.slots.takeCapacity({
        organizationId: input.organizationId,
        resourceId: resource.resourceId,
        capacity: resource.capacity,
        startsAt: input.startsAt,
        blockedEndsAt: input.blockedEndsAt,
      }),
    booking: built.booking,
    status: built.status as typeof BOOKING_STATUS.REQUESTED | typeof BOOKING_STATUS.CONFIRMED,
  });
}
