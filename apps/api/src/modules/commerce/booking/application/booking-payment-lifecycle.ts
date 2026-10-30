import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, SEQUENCE_KEY } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE, BOOKING_STATUS } from "@banijjik/contracts/booking";
import { asId, type BookingId, type OrganizationId } from "@banijjik/ids";
import { nextSequenceValue } from "../../../../kernel/sequence/index.js";
import {
  bookingHoldExpired,
  bookingPaymentFenceConflict,
  recordNotFound,
} from "../domain/errors.js";
import type { Booking } from "../domain/booking.entity.js";
import type { BookingRepository, BookingUnitOfWork } from "./ports/booking-repositories.js";
import type { DepositCheckPort } from "./ports/payment-ports.js";
import type { BookingSettingsReader } from "./ports/booking-context-ports.js";
import type { BookingEventPublisher } from "./use-cases/create-booking.use-case.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import { formatBookingNumber } from "./booking-transition-shared.js";

export interface BookingPaymentLifecyclePort {
  beginReceipt(input: {
    readonly organizationId: string;
    readonly bookingId: string;
    readonly now: Date;
  }): Promise<void>;
  endReceipt(input: {
    readonly organizationId: string;
    readonly bookingId: string;
    readonly now: Date;
  }): Promise<void>;
}

export interface BookingPaymentLifecycleDependencies {
  readonly bookings: BookingRepository;
  readonly unitOfWork: BookingUnitOfWork;
  readonly depositCheck: DepositCheckPort;
  readonly settings: BookingSettingsReader;
  readonly events: BookingEventPublisher;
  readonly audit: AuditRecorder;
}

function assertValidForReceipt(booking: Booking, now: Date): void {
  if (booking.status === BOOKING_STATUS.EXPIRED || booking.status === BOOKING_STATUS.NO_SHOW) {
    throw bookingPaymentFenceConflict();
  }
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    const fee = booking.cancellationFeeRetained?.amount ?? 0;
    if (fee <= 0) {
      throw bookingPaymentFenceConflict();
    }
  }
  if (booking.status === BOOKING_STATUS.HELD) {
    if (booking.holdExpiresAt !== null && booking.holdExpiresAt <= now) {
      throw bookingHoldExpired();
    }
  }
}

async function handleBeginReceipt(
  deps: BookingPaymentLifecycleDependencies,
  input: { organizationId: string; bookingId: string; now: Date },
): Promise<void> {
  const bookingId = asId<BookingId>(input.bookingId);
  const booking = await deps.bookings.findById(bookingId);
  if (!booking || booking.organizationId !== input.organizationId) {
    throw recordNotFound();
  }

  assertValidForReceipt(booking, input.now);

  if (booking.status === BOOKING_STATUS.HELD) {
    const updated = booking.incrementPaymentFence(input.now);
    await deps.unitOfWork.run(async () => {
      await deps.bookings.update(updated, booking.version);
    });
  }
}

async function transitionSatisfiedHold(params: {
  readonly deps: BookingPaymentLifecycleDependencies;
  readonly booking: Booking;
  readonly organizationId: OrganizationId;
  readonly now: Date;
}): Promise<void> {
  const { deps, booking, organizationId, now } = params;
  const settings = await deps.settings.read(organizationId);
  const seq = await nextSequenceValue({
    organizationId,
    sequenceKey: SEQUENCE_KEY.BOOKING,
  });

  const nextBooking = booking.transition("request", {
    now,
    actorUserId: null,
    bookingNumber: formatBookingNumber(seq),
  });

  const isRequested = settings.requireApproval;
  const eventType = isRequested
    ? BOOKING_EVENT_TYPE.BOOKING_REQUESTED
    : BOOKING_EVENT_TYPE.BOOKING_CONFIRMED;
  const auditAction = isRequested ? AUDIT_ACTION.BOOKING_CREATED : AUDIT_ACTION.BOOKING_CONFIRMED;

  await deps.unitOfWork.run(async () => {
    await deps.bookings.update(nextBooking, booking.version);
    await deps.events.publish(
      eventType,
      { bookingId: nextBooking.bookingId },
      { orderingKey: `booking:${nextBooking.bookingId}` },
    );
    await deps.audit.record({
      action: auditAction,
      entityType: AUDIT_ENTITY_TYPE.booking,
      entityId: nextBooking.bookingId,
      changes: {
        status: { to: nextBooking.status },
        bookingNumber: { to: nextBooking.bookingNumber },
      },
    });
  });
}

async function handleEndReceipt(
  deps: BookingPaymentLifecycleDependencies,
  input: { organizationId: string; bookingId: string; now: Date },
): Promise<void> {
  const bookingId = asId<BookingId>(input.bookingId);
  const organizationId = asId<OrganizationId>(input.organizationId);
  const booking = await deps.bookings.findById(bookingId);
  if (
    !booking ||
    booking.organizationId !== input.organizationId ||
    booking.status !== BOOKING_STATUS.HELD
  ) {
    return;
  }

  const satisfied = await deps.depositCheck.isDepositSatisfied({
    organizationId,
    requestId: booking.bookingId,
    requiredAmount: booking.depositRequired,
  });

  if (satisfied) {
    await transitionSatisfiedHold({ deps, booking, organizationId, now: input.now });
  }
}

export function buildBookingPaymentLifecycle(
  dependencies: BookingPaymentLifecycleDependencies,
): BookingPaymentLifecyclePort {
  return {
    beginReceipt: (input) => handleBeginReceipt(dependencies, input),
    endReceipt: (input) => handleEndReceipt(dependencies, input),
  };
}
