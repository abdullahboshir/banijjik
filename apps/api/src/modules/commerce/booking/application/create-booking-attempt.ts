import { OFFERING_KIND } from "@banijjik/contracts";
import { BOOKING_STATUS, type BookingResponse } from "@banijjik/contracts/booking";
import {
  asId,
  type LocationId,
  type MemberId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
  type UserId,
} from "@banijjik/ids";
import type { BookingCreateBody } from "@banijjik/validation/booking";
import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import { slotBounds } from "../domain/availability.js";
import { computeRentalTime } from "../domain/rental-time.js";
import { bookingRuleError } from "../domain/errors.js";
import { buildStaffBookingForSlot } from "./create-booking-context.js";
import { runWithTxnRetry } from "./run-with-txn-retry.js";
import { persistCreatedBooking } from "./create-booking-persist.js";
import { reserveResourceForSlot } from "./booking-slot-selection.js";
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
  const requestedStartsAt = new Date(input.body.startsAt);
  const slotOffering = await input.dependencies.offerings.readOffering({
    organizationId: input.organizationId,
    offeringId,
    variantId: input.body.variantId,
    locationId,
  });
  if (slotOffering === undefined || !slotOffering.isActive) {
    throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
  }
  const timeZone = await input.dependencies.timeZone.read(input.organizationId);

  let startsAt = requestedStartsAt;
  let blockedEndsAt: Date;
  let resourceTypeKeys: readonly string[] | undefined;
  let isRental = false;

  if (slotOffering.kind === OFFERING_KIND.RENTAL) {
    isRental = true;
    resourceTypeKeys = slotOffering.rental.resourceTypeKeys;
    const rentalTime = computeRentalTime({
      startsAt: requestedStartsAt,
      quantity: input.body.quantity,
      rental: slotOffering.rental,
      timeZone,
    });
    startsAt = rentalTime.startsAt;
    blockedEndsAt = rentalTime.blockedEndsAt;
  } else {
    resourceTypeKeys = slotOffering.service.resourceTypeKeys;
    const bounds = slotBounds(
      startsAt,
      slotOffering.durationMinutes,
      slotOffering.service.bufferAfterMinutes,
    );
    blockedEndsAt = bounds.blockedEndsAt;
  }

  const preferred =
    input.body.resourceId === undefined ? undefined : asId<ResourceId>(input.body.resourceId);

  return runWithTxnRetry(input.dependencies.unitOfWork, () =>
    tryCreateBookingOnce({
      ...input,
      locationId,
      offeringId,
      startsAt,
      blockedEndsAt,
      timeZone,
      resourceTypeKeys,
      isRental,
      preferred,
    }),
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
  const built = await buildStaffBookingForSlot({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    allowedLocationIds: input.allowedLocationIds,
    body: input.body,
    resource: {
      resourceId: resource.resourceId,
      memberId: resource.memberId as MemberId | null,
      capacity: resource.capacity,
    },
  });
  return await persistCreatedBooking({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    resourceId: built.resourceId,
    resourceCapacity: built.resourceCapacity,
    booking: built.booking,
    status: built.status as typeof BOOKING_STATUS.REQUESTED | typeof BOOKING_STATUS.CONFIRMED,
  });
}
