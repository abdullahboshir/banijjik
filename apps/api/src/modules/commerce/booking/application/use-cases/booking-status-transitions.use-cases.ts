import { AUDIT_ACTION, SEQUENCE_KEY } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE, BOOKING_STATUS } from "@banijjik/contracts/booking";
import type { BookingResponse } from "@banijjik/contracts/booking";
import { nextSequenceValue } from "../../../../../kernel/sequence/index.js";
import type { BookingId, OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { depositRequiredError, holdExpiredError, recordNotFound } from "../../domain/errors.js";
import type { DepositCheckPort } from "../ports/payment-ports.js";
import {
  assertLocationAllowed,
  bookingOrderingKey,
  formatBookingNumber,
} from "../booking-transition-shared.js";
import type { BookingSettingsReader } from "../ports/booking-context-ports.js";
import { toBookingResponse } from "../booking-views.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceSlotUsagePort,
} from "../ports/booking-repositories.js";
import type { BookingEventPublisher } from "./create-booking.use-case.js";

export class ConfirmBookingUseCase {
  constructor(
    private readonly dependencies: {
      readonly bookings: BookingRepository;
      readonly unitOfWork: BookingUnitOfWork;
      readonly events: BookingEventPublisher;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
      readonly depositCheck?: DepositCheckPort;
    },
  ) {}

  async execute(input: {
    readonly bookingId: BookingId;
    readonly version: number;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<BookingResponse> {
    const existing = await this.dependencies.bookings.findById(input.bookingId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);

    if (existing.depositRequired.amount > 0 && this.dependencies.depositCheck) {
      const satisfied = await this.dependencies.depositCheck.isDepositSatisfied({
        organizationId: existing.organizationId,
        requestId: existing.bookingId,
        requiredAmount: existing.depositRequired,
      });
      if (!satisfied) {
        throw depositRequiredError();
      }
    }

    return persistSimpleTransition({
      ...this.dependencies,
      input,
      action: "confirm",
      eventType: BOOKING_EVENT_TYPE.BOOKING_CONFIRMED,
      auditAction: AUDIT_ACTION.BOOKING_CONFIRMED,
    });
  }
}

export class RequestFromHoldUseCase {
  constructor(
    private readonly dependencies: {
      readonly bookings: BookingRepository;
      readonly unitOfWork: BookingUnitOfWork;
      readonly events: BookingEventPublisher;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
      readonly settings: BookingSettingsReader;
    },
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly bookingId: BookingId;
    readonly version: number;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<BookingResponse> {
    const existing = await this.dependencies.bookings.findById(input.bookingId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    const now = this.dependencies.clock.now();
    if (existing.holdExpiresAt !== null && existing.holdExpiresAt <= now) {
      throw holdExpiredError();
    }
    const bookingNumber = formatBookingNumber(
      await nextSequenceValue({
        organizationId: input.organizationId,
        sequenceKey: SEQUENCE_KEY.BOOKING,
      }),
    );
    const requested = existing.transition("request", {
      now,
      actorUserId: input.actorUserId,
      bookingNumber,
    });
    const eventType =
      requested.status === BOOKING_STATUS.REQUESTED
        ? BOOKING_EVENT_TYPE.BOOKING_REQUESTED
        : BOOKING_EVENT_TYPE.BOOKING_CONFIRMED;
    let persisted = requested;
    await this.dependencies.unitOfWork.run(async () => {
      persisted = await this.dependencies.bookings.update(requested, input.version);
      await this.dependencies.events.publish(
        eventType,
        { bookingId: persisted.bookingId },
        { orderingKey: bookingOrderingKey(persisted.bookingId) },
      );
      await this.dependencies.audit.record({
        action:
          persisted.status === BOOKING_STATUS.REQUESTED
            ? AUDIT_ACTION.BOOKING_CREATED
            : AUDIT_ACTION.BOOKING_CONFIRMED,
        entityType: "booking",
        entityId: persisted.bookingId,
        changes: { bookingNumber: { to: persisted.bookingNumber } },
      });
    });
    return toBookingResponse(persisted);
  }
}

export class CheckInBookingUseCase {
  constructor(
    private readonly dependencies: {
      readonly bookings: BookingRepository;
      readonly unitOfWork: BookingUnitOfWork;
      readonly events: BookingEventPublisher;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly bookingId: BookingId;
    readonly version: number;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<BookingResponse> {
    return persistSimpleTransition({
      ...this.dependencies,
      input,
      action: "checkIn",
      eventType: BOOKING_EVENT_TYPE.BOOKING_CHECK_IN_RECORDED,
      auditAction: AUDIT_ACTION.BOOKING_CHECKED_IN,
    });
  }
}

export class CompleteBookingUseCase {
  constructor(
    private readonly dependencies: {
      readonly bookings: BookingRepository;
      readonly unitOfWork: BookingUnitOfWork;
      readonly events: BookingEventPublisher;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly bookingId: BookingId;
    readonly version: number;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<BookingResponse> {
    return persistSimpleTransition({
      ...this.dependencies,
      input,
      action: "complete",
      eventType: BOOKING_EVENT_TYPE.BOOKING_COMPLETED,
      auditAction: AUDIT_ACTION.BOOKING_COMPLETED,
    });
  }
}

export class NoShowBookingUseCase {
  constructor(
    private readonly dependencies: {
      readonly bookings: BookingRepository;
      readonly slots: ResourceSlotUsagePort;
      readonly unitOfWork: BookingUnitOfWork;
      readonly events: BookingEventPublisher;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly bookingId: BookingId;
    readonly version: number;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<BookingResponse> {
    const existing = await this.dependencies.bookings.findById(input.bookingId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    const marked = existing.transition("noShow", {
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    let persisted = marked;
    await this.dependencies.unitOfWork.run(async () => {
      const resourceId = existing.resourceIds[0];
      if (resourceId !== undefined) {
        await this.dependencies.slots.releaseCapacity({
          organizationId: input.organizationId,
          resourceId,
          startsAt: existing.startsAt,
          blockedEndsAt: existing.blockedEndsAt,
        });
      }
      persisted = await this.dependencies.bookings.update(marked, input.version);
      await this.dependencies.events.publish(
        BOOKING_EVENT_TYPE.BOOKING_NO_SHOW_MARKED,
        { bookingId: persisted.bookingId },
        { orderingKey: bookingOrderingKey(persisted.bookingId) },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.BOOKING_NO_SHOW,
        entityType: "booking",
        entityId: persisted.bookingId,
        changes: {},
      });
    });
    return toBookingResponse(persisted);
  }
}

async function persistSimpleTransition(input: {
  bookings: BookingRepository;
  unitOfWork: BookingUnitOfWork;
  events: BookingEventPublisher;
  audit: AuditRecorder;
  clock: Clock;
  input: {
    readonly bookingId: BookingId;
    readonly version: number;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
  };
  action: "confirm" | "checkIn" | "complete";
  eventType: (typeof BOOKING_EVENT_TYPE)[keyof typeof BOOKING_EVENT_TYPE];
  auditAction: (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];
}): Promise<BookingResponse> {
  const existing = await input.bookings.findById(input.input.bookingId);
  if (existing === undefined) throw recordNotFound();
  assertLocationAllowed(existing.locationId, input.input.allowedLocationIds);
  const next = existing.transition(input.action, {
    now: input.clock.now(),
    actorUserId: input.input.actorUserId,
  });
  let persisted = next;
  await input.unitOfWork.run(async () => {
    persisted = await input.bookings.update(next, input.input.version);
    await input.events.publish(
      input.eventType,
      { bookingId: persisted.bookingId },
      { orderingKey: bookingOrderingKey(persisted.bookingId) },
    );
    await input.audit.record({
      action: input.auditAction,
      entityType: "booking",
      entityId: persisted.bookingId,
      changes: {},
    });
  });
  return toBookingResponse(persisted);
}
