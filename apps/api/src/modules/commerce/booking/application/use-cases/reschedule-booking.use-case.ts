import { DomainRuleError, ERROR_CODE, OFFERING_KIND } from "@banijjik/contracts";
import { BOOKING_KIND, BOOKING_RULE_KEY, type BookingResponse } from "@banijjik/contracts/booking";
import {
  asId,
  type BookingId,
  type OrganizationId,
  type ResourceId,
  type UserId,
} from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { slotBounds } from "../../domain/availability.js";
import type { Booking } from "../../domain/booking.entity.js";
import { computeRentalTime } from "../../domain/rental-time.js";
import { bookingRuleError, eventSoldOutError, recordNotFound } from "../../domain/errors.js";
import { assertLocationAllowed } from "../booking-transition-shared.js";
import { toBookingResponse } from "../booking-views.js";
import type { EventBookingTarget } from "../event-booking-parts.js";
import {
  rejectEventSessionOn,
  resolveEventRescheduleTarget,
  releaseBookingCapacity,
  reserveEventSeats,
} from "../event-booking-parts.js";
import { persistRescheduleInTxn } from "../reschedule-booking-txn.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceRepository,
  ResourceSlotUsagePort,
} from "../ports/booking-repositories.js";
import type {
  BookingOfferingReader,
  OfferingBookingView,
  OrganizationTimezoneReader,
} from "../ports/booking-context-ports.js";
import type { EventSessionRepository } from "../ports/event-session-repository.js";
import type { BookingEventPublisher } from "./create-booking.use-case.js";
import { runWithTxnRetry } from "../run-with-txn-retry.js";

/** The validation refine guarantees one of the two; this keeps the types honest. */
function requiredStartsAt(startsAt: string | undefined): string {
  if (startsAt === undefined) {
    throw new DomainRuleError({ code: ERROR_CODE.VALIDATION_ERROR });
  }
  return startsAt;
}

async function resolveSlotRescheduleBounds(input: {
  readonly offering: OfferingBookingView;
  readonly requestedStartsAt: Date;
  readonly quantity: number;
  readonly timeZone: string;
}): Promise<{ startsAt: Date; endsAt: Date; blockedEndsAt: Date }> {
  if (input.offering.kind === OFFERING_KIND.RENTAL) {
    const rentalTime = computeRentalTime({
      startsAt: input.requestedStartsAt,
      quantity: input.quantity,
      rental: input.offering.rental,
      timeZone: input.timeZone,
    });
    return {
      startsAt: rentalTime.startsAt,
      endsAt: rentalTime.endsAt,
      blockedEndsAt: rentalTime.blockedEndsAt,
    };
  }
  if (input.offering.kind === OFFERING_KIND.EVENT) {
    throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
  }
  const bounds = slotBounds(
    input.requestedStartsAt,
    input.offering.durationMinutes,
    input.offering.service.bufferAfterMinutes,
  );
  return {
    startsAt: input.requestedStartsAt,
    endsAt: bounds.endsAt,
    blockedEndsAt: bounds.blockedEndsAt,
  };
}

/** Seats move as one: the new session takes the seats while the old booking still holds them. */
async function moveEventSeats(input: {
  readonly sessions: EventSessionRepository;
  readonly from: Booking;
  readonly to: EventBookingTarget;
}): Promise<void> {
  await reserveEventSeats({
    sessions: input.sessions,
    eventSessionId: input.to.eventSessionId,
    seats: input.to.seats,
  });
  const oldSessionId = input.from.eventSessionId;
  if (oldSessionId !== null) {
    await input.sessions.releaseSeats({ eventSessionId: oldSessionId, seats: input.from.quantity });
  }
}

/** The slot handover: the old time gives its buckets back, the new time takes them. */
async function moveSlotCapacity(input: {
  readonly slots: ResourceSlotUsagePort;
  readonly sessions: EventSessionRepository;
  readonly organizationId: OrganizationId;
  readonly from: Booking;
  readonly resourceId: ResourceId;
  readonly capacity: number;
  readonly startsAt: Date;
  readonly blockedEndsAt: Date;
}): Promise<void> {
  await releaseBookingCapacity({
    booking: input.from,
    slots: input.slots,
    sessions: input.sessions,
  });
  await input.slots.takeCapacity({
    organizationId: input.organizationId,
    resourceId: input.resourceId,
    capacity: input.capacity,
    startsAt: input.startsAt,
    blockedEndsAt: input.blockedEndsAt,
  });
}

export class RescheduleBookingUseCase {
  constructor(
    private readonly dependencies: {
      readonly bookings: BookingRepository;
      readonly resources: ResourceRepository;
      readonly slots: ResourceSlotUsagePort;
      readonly sessions: EventSessionRepository;
      readonly unitOfWork: BookingUnitOfWork;
      readonly events: BookingEventPublisher;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
      readonly offerings: BookingOfferingReader;
      readonly timeZone: OrganizationTimezoneReader;
    },
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly bookingId: BookingId;
    readonly version: number;
    readonly startsAt?: string | undefined;
    readonly eventSessionId?: string | undefined;
    readonly resourceId?: string;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<BookingResponse> {
    const existing = await this.dependencies.bookings.findById(input.bookingId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    const offering = await this.dependencies.offerings.readOffering({
      organizationId: input.organizationId,
      offeringId: existing.offeringId,
      variantId: existing.variantId,
      locationId: existing.locationId,
    });
    if (offering === undefined) throw recordNotFound();

    if (existing.kind === BOOKING_KIND.EVENT) {
      return this.rescheduleEventBooking(input, existing, offering);
    }
    rejectEventSessionOn(input.eventSessionId);
    return this.rescheduleSlotBooking(input, existing, offering);
  }

  /** Seats move first, so the new session is checked while the old seat is still held. */
  private async rescheduleEventBooking(
    input: {
      readonly organizationId: OrganizationId;
      readonly bookingId: BookingId;
      readonly version: number;
      readonly eventSessionId?: string | undefined;
      readonly actorUserId: UserId | null;
    },
    existing: Booking,
    offering: OfferingBookingView,
  ): Promise<BookingResponse> {
    const now = this.dependencies.clock.now();
    const target = await resolveEventRescheduleTarget({
      sessions: this.dependencies.sessions,
      offering,
      booking: existing,
      eventSessionId: input.eventSessionId,
      now,
    });
    const updated = existing.transition("reschedule", {
      now,
      actorUserId: input.actorUserId,
      reschedule: {
        startsAt: target.startsAt,
        endsAt: target.endsAt,
        blockedEndsAt: target.blockedEndsAt,
        resourceIds: target.resourceIds,
        providerMemberId: null,
        eventSessionId: target.eventSessionId,
      },
    });
    const sessions = this.dependencies.sessions;
    let persisted = updated;
    await runWithTxnRetry(
      this.dependencies.unitOfWork,
      async () => {
        persisted = await persistRescheduleInTxn({
          dependencies: this.dependencies,
          organizationId: input.organizationId,
          bookingId: input.bookingId,
          version: input.version,
          existing,
          updated,
          moveCapacity: () => moveEventSeats({ sessions, from: existing, to: target }),
        });
      },
      eventSoldOutError,
    );
    return toBookingResponse(persisted);
  }

  private async rescheduleSlotBooking(
    input: {
      readonly organizationId: OrganizationId;
      readonly bookingId: BookingId;
      readonly version: number;
      readonly startsAt?: string | undefined;
      readonly resourceId?: string;
      readonly actorUserId: UserId | null;
    },
    existing: Booking,
    offering: OfferingBookingView,
  ): Promise<BookingResponse> {
    const timeZone = await this.dependencies.timeZone.read(input.organizationId);
    const { startsAt, endsAt, blockedEndsAt } = await resolveSlotRescheduleBounds({
      offering,
      requestedStartsAt: new Date(requiredStartsAt(input.startsAt)),
      quantity: existing.quantity,
      timeZone,
    });

    const preferredId = input.resourceId ?? existing.resourceIds[0];
    if (preferredId === undefined) throw recordNotFound();
    const resourceId = asId<ResourceId>(preferredId);
    const resource = await this.dependencies.resources.findById(resourceId);
    if (resource === undefined) throw recordNotFound();

    const updated = existing.transition("reschedule", {
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
      reschedule: {
        startsAt,
        endsAt,
        blockedEndsAt,
        resourceIds: [resource.resourceId],
        providerMemberId: resource.memberId,
      },
    });

    let persisted = updated;
    await runWithTxnRetry(this.dependencies.unitOfWork, async () => {
      persisted = await persistRescheduleInTxn({
        dependencies: this.dependencies,
        organizationId: input.organizationId,
        bookingId: input.bookingId,
        version: input.version,
        existing,
        updated,
        moveCapacity: () =>
          moveSlotCapacity({
            slots: this.dependencies.slots,
            sessions: this.dependencies.sessions,
            organizationId: input.organizationId,
            from: existing,
            resourceId: resource.resourceId,
            capacity: resource.capacity,
            startsAt,
            blockedEndsAt,
          }),
      });
    });

    return toBookingResponse(persisted);
  }
}
