import { OFFERING_KIND } from "@banijjik/contracts";
import type { ContactId, LocationId, OfferingId, OrganizationId, UserId } from "@banijjik/ids";
import type { BookingCreateBody } from "@banijjik/validation/booking";
import type { BookingKind, Money } from "@banijjik/contracts/booking";
import { BOOKING_KIND, BOOKING_STATUS } from "@banijjik/contracts/booking";
import { asId } from "@banijjik/ids";
import { slotBounds } from "../domain/availability.js";
import { computeRentalTime } from "../domain/rental-time.js";
import { resolveBookingContactId } from "./booking-slot-selection.js";
import type { CreateBookingDependencies } from "./use-cases/create-booking.use-case.js";
import {
  loadActiveOffering,
  quoteDepositForBooking,
  staffBookingStatusAndNumber,
} from "./staff-booking-quote.js";
import type { OfferingBookingView, PriceQuoterPort } from "./ports/booking-context-ports.js";

async function staffQuoteContext(input: {
  dependencies: CreateBookingDependencies;
  organizationId: OrganizationId;
  actorUserId: UserId | null;
  allowedLocationIds: readonly string[] | "ALL";
  body: BookingCreateBody;
  locationId: LocationId;
  offeringId: OfferingId;
}) {
  const offering = await loadActiveOffering({
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
    quantity: input.body.quantity,
    offering,
  });
  return { offering, contactId, line, depositRequired };
}

async function resolveStaffBookingBounds(input: {
  readonly offering: OfferingBookingView;
  readonly requestedStartsAt: Date;
  readonly requestedQuantity: number | undefined;
  readonly timeZoneReader: { read(organizationId: OrganizationId): Promise<string> };
  readonly organizationId: OrganizationId;
}) {
  if (input.offering.kind === OFFERING_KIND.RENTAL) {
    const timeZone = await input.timeZoneReader.read(input.organizationId);
    const rentalTime = computeRentalTime({
      startsAt: input.requestedStartsAt,
      quantity: input.requestedQuantity,
      rental: input.offering.rental,
      timeZone,
    });
    return {
      kind: BOOKING_KIND.RENTAL,
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
    startsAt: input.requestedStartsAt,
    endsAt: bounds.endsAt,
    blockedEndsAt: bounds.blockedEndsAt,
    quantity: 1,
  };
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
  kind: BookingKind;
  quantity: number;
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
  const requestedStartsAt = new Date(input.body.startsAt);
  const quoted = await staffQuoteContext({
    dependencies: input.dependencies,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    allowedLocationIds: input.allowedLocationIds,
    body: input.body,
    locationId,
    offeringId,
  });

  const bounds = await resolveStaffBookingBounds({
    offering: quoted.offering,
    requestedStartsAt,
    requestedQuantity: input.body.quantity,
    timeZoneReader: input.dependencies.timeZone,
    organizationId: input.organizationId,
  });

  const settings = await input.dependencies.settings.read(input.organizationId);
  const now = input.dependencies.clock.now();
  const requireApproval = settings.requireApproval || quoted.depositRequired.amount > 0;
  const outcome = await staffBookingStatusAndNumber({
    organizationId: input.organizationId,
    requireApproval,
  });
  return {
    locationId,
    offeringId,
    contactId: quoted.contactId,
    ...bounds,
    depositRequired: quoted.depositRequired,
    status: outcome.status,
    bookingNumber: outcome.bookingNumber,
    line: quoted.line,
    now,
  };
}
