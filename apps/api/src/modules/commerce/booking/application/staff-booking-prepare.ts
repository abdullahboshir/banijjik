import type { ContactId, LocationId, OfferingId, OrganizationId, UserId } from "@banijjik/ids";
import type { BookingCreateBody } from "@banijjik/validation/booking";
import type { Money } from "@banijjik/contracts/booking";
import { BOOKING_STATUS } from "@banijjik/contracts/booking";
import { asId } from "@banijjik/ids";
import { slotBounds } from "../domain/availability.js";
import { resolveBookingContactId } from "./booking-slot-selection.js";
import type { CreateBookingDependencies } from "./use-cases/create-booking.use-case.js";
import {
  loadActiveServiceOffering,
  quoteDepositForBooking,
  staffBookingStatusAndNumber,
} from "./staff-booking-quote.js";
import type { PriceQuoterPort } from "./ports/booking-context-ports.js";

async function staffQuoteContext(input: {
  dependencies: CreateBookingDependencies;
  organizationId: OrganizationId;
  actorUserId: UserId | null;
  allowedLocationIds: readonly string[] | "ALL";
  body: BookingCreateBody;
  locationId: LocationId;
  offeringId: OfferingId;
}) {
  const offering = await loadActiveServiceOffering({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    offeringId: input.offeringId,
    variantId: input.body.variantId,
    locationId: input.locationId,
  });
  const contactId = await resolveBookingContactId(input.dependencies.contacts, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    allowedLocationIds: input.allowedLocationIds,
    body: input.body,
  });
  const { line, depositRequired } = await quoteDepositForBooking({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    locationId: input.body.locationId,
    offeringId: input.body.offeringId,
    variantId: input.body.variantId,
    offering,
  });
  return { offering, contactId, line, depositRequired };
}

export async function prepareStaffBooking(input: {
  dependencies: CreateBookingDependencies;
  organizationId: OrganizationId;
  actorUserId: UserId | null;
  allowedLocationIds: readonly string[] | "ALL";
  body: BookingCreateBody;
}): Promise<{
  locationId: LocationId;
  offeringId: OfferingId;
  contactId: ContactId;
  startsAt: Date;
  endsAt: Date;
  blockedEndsAt: Date;
  depositRequired: Money;
  status: typeof BOOKING_STATUS.REQUESTED | typeof BOOKING_STATUS.CONFIRMED;
  bookingNumber: string | null;
  line: NonNullable<Awaited<ReturnType<PriceQuoterPort["quote"]>>["lines"][0]>;
  now: Date;
}> {
  const locationId = asId<LocationId>(input.body.locationId);
  const offeringId = asId<OfferingId>(input.body.offeringId);
  const startsAt = new Date(input.body.startsAt);
  const quoted = await staffQuoteContext({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    allowedLocationIds: input.allowedLocationIds,
    body: input.body,
    locationId,
    offeringId,
  });
  const { endsAt, blockedEndsAt } = slotBounds(
    startsAt,
    quoted.offering.durationMinutes,
    quoted.offering.service.bufferAfterMinutes,
  );
  const settings = await input.dependencies.settings.read(input.organizationId);
  const now = input.dependencies.clock.now();
  const { status, bookingNumber } = await staffBookingStatusAndNumber({
    organizationId: input.organizationId,
    requireApproval: settings.requireApproval,
  });
  return {
    locationId,
    offeringId,
    contactId: quoted.contactId,
    startsAt,
    endsAt,
    blockedEndsAt,
    depositRequired: quoted.depositRequired,
    status,
    bookingNumber,
    line: quoted.line,
    now,
  };
}
