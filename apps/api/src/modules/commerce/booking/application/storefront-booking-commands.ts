import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, OFFERING_KIND, SEQUENCE_KEY } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE, BOOKING_SOURCE, BOOKING_STATUS } from "@banijjik/contracts/booking";
import type {
  CheckoutRequestLink,
  CheckoutSelection,
  PublicBookingCommands,
  PublicSelection,
  StorefrontCommandContext,
} from "@banijjik/contracts/website";
import { asId, type LocationId, type OrganizationId, type ResourceId } from "@banijjik/ids";
import { nextSequenceValue } from "../../../../kernel/sequence/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import { recordNotFound } from "../domain/errors.js";
import { formatBookingNumber } from "./booking-transition-shared.js";
import { assembleHoldBooking } from "./hold-booking-assembler.js";
import type { HoldCapacity } from "./hold-booking-reserve.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceRepository,
  ResourceSlotUsagePort,
} from "./ports/booking-repositories.js";
import type {
  BookingOfferingReader,
  BookingSettingsReader,
  ContactCreator,
  PriceQuoterPort,
} from "./ports/booking-context-ports.js";
import type { EventSessionRepository } from "./ports/event-session-repository.js";
import type { DepositCheckPort } from "./ports/payment-ports.js";
import type { BookingEventPublisher } from "./use-cases/create-booking.use-case.js";
import type { BookingHoldBody } from "@banijjik/validation/booking";
import type { Booking } from "../domain/booking.entity.js";

export interface BookingStorefrontDependencies {
  readonly bookings: BookingRepository;
  readonly resources: ResourceRepository;
  readonly slots: ResourceSlotUsagePort;
  readonly sessions: EventSessionRepository;
  readonly unitOfWork: BookingUnitOfWork;
  readonly events: BookingEventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly offerings: BookingOfferingReader;
  readonly settings: BookingSettingsReader;
  readonly quoter: PriceQuoterPort;
  readonly contacts: ContactCreator;
  readonly timeZone: { read(organizationId: OrganizationId): Promise<string> };
  readonly timeOff: {
    listOverlapping(
      resourceId: ResourceId,
      from: Date,
      to: Date,
    ): Promise<readonly { startsAt: Date; endsAt: Date }[]>;
  };
  readonly kinds: {
    effectiveKinds(organizationId: OrganizationId): Promise<readonly string[]>;
  };
  readonly depositCheck: DepositCheckPort;
}

const ALLOWED_KINDS: readonly string[] = [
  OFFERING_KIND.SERVICE,
  OFFERING_KIND.RENTAL,
  OFFERING_KIND.EVENT,
];

function extractHoldBody(
  context: StorefrontCommandContext,
  selection: PublicSelection,
): BookingHoldBody {
  if (selection.kind === "SERVICE") {
    return {
      offeringId: selection.offeringId,
      variantId: selection.variantId,
      locationId: context.locationId,
      startsAt: selection.startsAt,
      quantity: 1,
      resourceId: selection.resourceIds[0],
      contactId: context.contactId,
    };
  }
  if (selection.kind === "RENTAL") {
    return {
      offeringId: selection.offeringId,
      variantId: selection.variantId,
      locationId: context.locationId,
      startsAt: selection.startsAt,
      quantity: 1,
      resourceId: selection.resourceIds[0],
      contactId: context.contactId,
    };
  }
  if (selection.kind === "EVENT") {
    return {
      offeringId: selection.offeringId,
      variantId: selection.variantId,
      locationId: context.locationId,
      startsAt: new Date().toISOString(),
      eventSessionId: selection.eventSessionId,
      quantity: selection.quantity,
      contactId: context.contactId,
    };
  }
  throw recordNotFound();
}

async function persistHeldState(params: {
  readonly deps: BookingStorefrontDependencies;
  readonly booking: Booking;
  readonly capacity: HoldCapacity;
  readonly organizationId: OrganizationId;
  readonly now: Date;
}): Promise<void> {
  const { deps, booking, capacity, organizationId, now } = params;
  await deps.unitOfWork.run(async () => {
    await capacity.reserve();
    await deps.bookings.insert(booking);
    await deps.depositCheck.initializeSummary({
      organizationId,
      requestId: booking.bookingId,
      contactId: booking.contactId,
      locationId: booking.locationId,
      total: booking.price.total,
      actorUserId: null,
      now,
    });
    await deps.events.publish(
      BOOKING_EVENT_TYPE.BOOKING_HELD,
      { bookingId: booking.bookingId },
      { orderingKey: `booking:${booking.bookingId}` },
    );
    await deps.audit.record({
      action: AUDIT_ACTION.BOOKING_CREATED,
      entityType: AUDIT_ENTITY_TYPE.booking,
      entityId: booking.bookingId,
      changes: { status: { to: booking.status } },
    });
  });
}

async function persistRequestedOrConfirmed(params: {
  readonly deps: BookingStorefrontDependencies;
  readonly booking: Booking;
  readonly capacity: HoldCapacity;
  readonly organizationId: OrganizationId;
  readonly now: Date;
}): Promise<Booking> {
  const { deps, booking, capacity, organizationId, now } = params;
  const settings = await deps.settings.read(organizationId);

  let bookingNumber: string | null = null;
  if (!settings.requireApproval) {
    const seq = await nextSequenceValue({
      organizationId,
      sequenceKey: SEQUENCE_KEY.BOOKING,
    });
    bookingNumber = formatBookingNumber(seq);
  }

  const transitioned = booking.transition("request", {
    now,
    actorUserId: null,
    bookingNumber,
  });

  const isRequested = transitioned.status === BOOKING_STATUS.REQUESTED;
  const eventType = isRequested
    ? BOOKING_EVENT_TYPE.BOOKING_REQUESTED
    : BOOKING_EVENT_TYPE.BOOKING_CONFIRMED;
  const auditAction = isRequested ? AUDIT_ACTION.BOOKING_CREATED : AUDIT_ACTION.BOOKING_CONFIRMED;

  await deps.unitOfWork.run(async () => {
    await capacity.reserve();
    await deps.bookings.insert(transitioned);
    await deps.depositCheck.initializeSummary({
      organizationId,
      requestId: transitioned.bookingId,
      contactId: transitioned.contactId,
      locationId: transitioned.locationId,
      total: transitioned.price.total,
      actorUserId: null,
      now,
    });
    await deps.events.publish(
      eventType,
      { bookingId: transitioned.bookingId },
      { orderingKey: `booking:${transitioned.bookingId}` },
    );
    await deps.audit.record({
      action: auditAction,
      entityType: AUDIT_ENTITY_TYPE.booking,
      entityId: transitioned.bookingId,
      changes: {
        status: { to: transitioned.status },
        ...(bookingNumber ? { bookingNumber: { to: bookingNumber } } : {}),
      },
    });
  });

  return transitioned;
}

async function assertOfferingKindAllowed(
  deps: BookingStorefrontDependencies,
  organizationId: OrganizationId,
  kind: string,
): Promise<void> {
  if (!ALLOWED_KINDS.includes(kind)) {
    throw recordNotFound();
  }
  const effectiveKinds = await deps.kinds.effectiveKinds(organizationId);
  if (!effectiveKinds.includes(kind)) {
    throw recordNotFound();
  }
}

function toCheckoutRequestLink(
  selectionId: string,
  booking: Booking,
  isHeld: boolean,
): CheckoutRequestLink {
  if (isHeld) {
    return {
      selectionIds: [selectionId],
      requestType: "BOOKING",
      requestId: booking.bookingId,
      publicNumber: null,
      status: BOOKING_STATUS.HELD,
      paymentRequired: booking.depositRequired,
      holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
    };
  }
  return {
    selectionIds: [selectionId],
    requestType: "BOOKING",
    requestId: booking.bookingId,
    publicNumber: booking.bookingNumber,
    status: booking.status,
    paymentRequired: { amount: 0, currency: booking.price.currency },
    holdExpiresAt: null,
  };
}

async function handleRequestCommand(
  deps: BookingStorefrontDependencies,
  context: StorefrontCommandContext,
  input: CheckoutSelection,
): Promise<CheckoutRequestLink> {
  const selection = input.selection;
  const organizationId = asId<OrganizationId>(context.organizationId);
  const locationId = asId<LocationId>(context.locationId);

  await assertOfferingKindAllowed(deps, organizationId, selection.kind);

  const body = extractHoldBody(context, selection);
  const now = deps.clock.now();

  const assembled = await assembleHoldBooking({
    dependencies: deps,
    organizationId,
    actorUserId: null,
    allowedLocationIds: [locationId],
    body,
    source: BOOKING_SOURCE.STOREFRONT,
    checkoutId: context.checkoutId,
  });

  if (assembled.booking.depositRequired.amount > 0) {
    await persistHeldState({
      deps,
      booking: assembled.booking,
      capacity: assembled.capacity,
      organizationId,
      now,
    });
    return toCheckoutRequestLink(input.selectionId, assembled.booking, true);
  }

  const transitioned = await persistRequestedOrConfirmed({
    deps,
    booking: assembled.booking,
    capacity: assembled.capacity,
    organizationId,
    now,
  });
  return toCheckoutRequestLink(input.selectionId, transitioned, false);
}

export function buildStorefrontBookingCommands(
  dependencies: BookingStorefrontDependencies,
): PublicBookingCommands {
  return {
    request: (context, input) => handleRequestCommand(dependencies, context, input),
  };
}
