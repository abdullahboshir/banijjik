import { AUDIT_ACTION, MODULE_KEY } from "@banijjik/contracts";
import {
  BOOKING_EVENT_TYPE,
  BOOKING_EVENT_SESSION_CANCEL_NOTE_KEY,
  BOOKING_FREE_CANCEL_HOURS_DEFAULT,
  BOOKING_TERMINATION_MODE,
  CANCEL_FEE_MODE,
} from "@banijjik/contracts/booking";
import type { EventSessionId } from "@banijjik/ids";
import { getLogger } from "../../../../../kernel/logger/index.js";
import type { ScheduledJob } from "../../../../../kernel/jobs/index.js";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Booking } from "../../domain/booking.entity.js";
import type { EventSession } from "../../domain/event-session.entity.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceSlotUsagePort,
} from "../ports/booking-repositories.js";
import type { EventSessionRepository } from "../ports/event-session-repository.js";
import type { DepositCheckPort } from "../ports/payment-ports.js";
import { releaseBookingCapacity } from "../event-booking-parts.js";
import type { BookingEventPublisher } from "../use-cases/create-booking.use-case.js";

/** Sessions read per page; each one settles a page of its bookings per run, the rest wait for the next tick. */
const CANCELLED_SESSION_BATCH = 10;

interface CancelEventSessionDependencies {
  readonly sessions: EventSessionRepository;
  readonly bookings: BookingRepository;
  readonly slots: ResourceSlotUsagePort;
  readonly unitOfWork: BookingUnitOfWork;
  readonly events: BookingEventPublisher;
  readonly audit: AuditRecorder;
  readonly depositCheck: DepositCheckPort;
  /** Test hook for the page size of the cancelled-session read. */
  readonly sessionPageSize?: number;
}

/**
 * The organization closed the session, so the customer never owes a fee: the whole paid amount
 * comes back as store credit. `feeMode: NONE` makes the settlement idempotent by request id.
 */
async function refundPaidDeposit(input: {
  readonly depositCheck: DepositCheckPort;
  readonly row: Booking;
  readonly now: Date;
}): Promise<void> {
  await input.depositCheck.settleBookingTermination({
    organizationId: input.row.organizationId,
    requestId: input.row.bookingId,
    contactId: input.row.contactId,
    locationId: input.row.locationId,
    startsAt: input.row.startsAt,
    depositRequired: input.row.depositRequired,
    priceTotal: input.row.price.total,
    mode: BOOKING_TERMINATION_MODE.CANCEL,
    freeCancelHours: BOOKING_FREE_CANCEL_HOURS_DEFAULT,
    feeMode: CANCEL_FEE_MODE.NONE,
    feePercent: 0,
    actorUserId: null,
    now: input.now,
  });
}

async function cancelOneBooking(input: {
  readonly deps: CancelEventSessionDependencies;
  readonly row: Booking;
  readonly now: Date;
}): Promise<void> {
  const { deps, row, now } = input;
  await deps.unitOfWork.run(async () => {
    await releaseBookingCapacity({ booking: row, slots: deps.slots, sessions: deps.sessions });
    await refundPaidDeposit({ depositCheck: deps.depositCheck, row, now });
    const next = row.transition("cancel", {
      now,
      actorUserId: null,
      note: BOOKING_EVENT_SESSION_CANCEL_NOTE_KEY,
    });
    const cancelled = await deps.bookings.update(next, row.version);
    await deps.events.publish(
      BOOKING_EVENT_TYPE.BOOKING_CANCELLED,
      { bookingId: cancelled.bookingId },
      { orderingKey: `booking:${cancelled.bookingId}` },
    );
    await deps.audit.record({
      action: AUDIT_ACTION.BOOKING_CANCELLED,
      entityType: "booking",
      entityId: cancelled.bookingId,
      changes: { note: { to: BOOKING_EVENT_SESSION_CANCEL_NOTE_KEY } },
    });
  });
}

async function settleOneSession(input: {
  readonly deps: CancelEventSessionDependencies;
  readonly session: EventSession;
  readonly organizationId: string;
  readonly now: Date;
}): Promise<boolean> {
  const { deps, session, organizationId, now } = input;
  const eventSessionId = session.toProps().eventSessionId;
  const open = await deps.bookings.listOpenForEventSession(eventSessionId);
  for (const row of open) {
    try {
      await cancelOneBooking({ deps, row, now });
    } catch (error) {
      // A 409 here means staff changed the booking meanwhile; the next run picks it up again.
      getLogger().error(
        {
          event: "booking.cancel_event_session_booking_failed",
          organizationId,
          eventSessionId,
          bookingId: row.bookingId,
          err: error,
        },
        "cancelling one booking of a cancelled event session failed",
      );
    }
  }
  const remaining = await deps.bookings.listOpenForEventSession(eventSessionId);
  if (remaining.length === 0) {
    await deps.sessions.markBookingsSettled({ eventSessionId, now });
    return true;
  }
  return false;
}

/** A session that fails is logged and left unsettled; it must not stop the sessions behind it. */
async function settleSessionSafely(input: {
  readonly deps: CancelEventSessionDependencies;
  readonly session: EventSession;
  readonly organizationId: string;
  readonly now: Date;
}): Promise<void> {
  const { deps, session, organizationId, now } = input;
  const eventSessionId = session.toProps().eventSessionId;
  try {
    const settled = await settleOneSession({ deps, session, organizationId, now });
    if (settled) return;
    getLogger().warn(
      { event: "booking.cancel_event_session_incomplete", organizationId, eventSessionId },
      "a cancelled event session still has open bookings, another run is needed",
    );
  } catch (error) {
    getLogger().error(
      { event: "booking.cancel_event_session_failed", organizationId, eventSessionId, err: error },
      "settling one cancelled event session failed",
    );
  }
}

export function buildCancelEventSessionJob(input: CancelEventSessionDependencies): ScheduledJob {
  const pageSize = input.sessionPageSize ?? CANCELLED_SESSION_BATCH;
  return {
    jobKey: "booking.cancelEventSession",
    everyMinutes: 1,
    moduleKey: MODULE_KEY.BOOKING,
    run: async (organizationId, now) => {
      // The cursor moves past every session of a page, so sessions that fail on every run
      // cannot sit in front of the later ones and starve them.
      let afterEventSessionId: EventSessionId | null = null;
      for (;;) {
        const sessions = await input.sessions.listUnsettledCancellations({
          afterEventSessionId,
          limit: pageSize,
        });
        for (const session of sessions) {
          await settleSessionSafely({ deps: input, session, organizationId, now });
        }
        const lastSession = sessions.at(-1);
        if (lastSession === undefined || sessions.length < pageSize) return;
        afterEventSessionId = lastSession.toProps().eventSessionId;
      }
    },
  };
}
