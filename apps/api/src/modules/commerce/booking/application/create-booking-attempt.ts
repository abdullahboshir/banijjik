import { ERROR_CODE } from "@banijjik/contracts";
import { BOOKING_STATUS, type BookingResponse } from "@banijjik/contracts/booking";
import { AppError } from "../../../../kernel/http/app-error.js";
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
import { bookingRuleError, slotUnavailableError } from "../domain/errors.js";
import { buildStaffBookingForSlot } from "./create-booking-context.js";
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
  const startsAt = new Date(input.body.startsAt);
  const slotOffering = await input.dependencies.offerings.readServiceOffering({
    organizationId: input.organizationId,
    offeringId,
    variantId: input.body.variantId,
    locationId,
  });
  if (slotOffering === undefined || !slotOffering.isActive) {
    throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
  }
  const { blockedEndsAt } = slotBounds(
    startsAt,
    slotOffering.durationMinutes,
    slotOffering.service.bufferAfterMinutes,
  );
  const timeZone = await input.dependencies.timeZone.read(input.organizationId);
  const preferred =
    input.body.resourceId === undefined ? undefined : asId<ResourceId>(input.body.resourceId);

  for (let attempt = 1; attempt <= 12; attempt++) {
    const response = await tryCreateBookingOnce({
      ...input,
      locationId,
      offeringId,
      startsAt,
      blockedEndsAt,
      timeZone,
      preferred,
      attempt,
    });
    if (response !== undefined) return response;
  }
  throw slotUnavailableError();
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
  preferred: ResourceId | undefined;
  attempt: number;
}): Promise<BookingResponse | undefined> {
  const resource = await reserveResourceForSlot({
    resources: input.dependencies.resources,
    slots: input.dependencies.slots,
    organizationId: input.organizationId,
    locationId: input.locationId,
    offeringId: input.offeringId,
    startsAt: input.startsAt,
    blockedEndsAt: input.blockedEndsAt,
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
  try {
    return await persistCreatedBooking({
      dependencies: input.dependencies,
      organizationId: input.organizationId,
      resourceId: built.resourceId,
      resourceCapacity: built.resourceCapacity,
      booking: built.booking,
      status: built.status as typeof BOOKING_STATUS.REQUESTED | typeof BOOKING_STATUS.CONFIRMED,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === ERROR_CODE.RETRY_LATER && input.attempt < 12) {
      return undefined;
    }
    throw error;
  }
}
