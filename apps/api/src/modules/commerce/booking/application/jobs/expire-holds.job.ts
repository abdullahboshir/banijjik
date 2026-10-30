import { MODULE_KEY } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE, BOOKING_STATUS } from "@banijjik/contracts/booking";
import type { BookingEventPublisher } from "../use-cases/create-booking.use-case.js";
import type { ScheduledJob } from "../../../../../kernel/jobs/index.js";
import { getLogger } from "../../../../../kernel/logger/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceSlotUsagePort,
} from "../ports/booking-repositories.js";
import type { EventSessionRepository } from "../ports/event-session-repository.js";
import type { DepositCheckPort } from "../ports/payment-ports.js";
import { releaseBookingCapacity } from "../event-booking-parts.js";

import type { Booking } from "../../domain/booking.entity.js";

export interface ExpireHoldsJobInput {
  readonly bookings: BookingRepository;
  readonly slots: ResourceSlotUsagePort;
  readonly sessions: EventSessionRepository;
  readonly unitOfWork: BookingUnitOfWork;
  readonly events: BookingEventPublisher;
  readonly clock: Clock;
  readonly depositCheck?: DepositCheckPort;
}

async function terminateDepositIfNeeded(
  depositCheck: DepositCheckPort | undefined,
  current: Booking,
  now: Date,
): Promise<void> {
  if (!depositCheck) return;
  await depositCheck.settleBookingTermination({
    organizationId: current.organizationId,
    requestId: current.bookingId,
    contactId: current.contactId,
    locationId: current.locationId,
    startsAt: current.startsAt,
    depositRequired: current.depositRequired,
    priceTotal: current.price.total,
    mode: "CANCEL",
    freeCancelHours: 0,
    feeMode: "NONE",
    feePercent: 0,
    actorUserId: null,
    now,
  });
}

async function expireSingleHold(
  input: ExpireHoldsJobInput,
  row: Booking,
  now: Date,
): Promise<void> {
  await input.unitOfWork.run(async () => {
    const current = await input.bookings.findById(row.bookingId);
    if (!current || current.status !== BOOKING_STATUS.HELD) {
      return;
    }
    if (
      current.paymentFenceVersion > 0 ||
      current.paymentFenceVersion !== row.paymentFenceVersion
    ) {
      return;
    }

    await terminateDepositIfNeeded(input.depositCheck, current, now);
    await releaseBookingCapacity({
      booking: current,
      slots: input.slots,
      sessions: input.sessions,
    });
    const next = current.transition("expire", { now, actorUserId: null });
    await input.bookings.update(next, current.version);
    await input.events.publish(
      BOOKING_EVENT_TYPE.BOOKING_EXPIRED,
      { bookingId: current.bookingId },
      { orderingKey: `booking:${current.bookingId}` },
    );
  });
}

export function buildExpireHoldsJob(input: ExpireHoldsJobInput): ScheduledJob {
  return {
    jobKey: "booking.expireHolds",
    everyMinutes: 1,
    moduleKey: MODULE_KEY.BOOKING,
    run: async (organizationId, now) => {
      const held = await input.bookings.listHeldExpired(now);
      for (const row of held) {
        try {
          await expireSingleHold(input, row, now);
        } catch (error) {
          getLogger().error(
            {
              event: "booking.expire_hold_failed",
              organizationId,
              bookingId: row.bookingId,
              err: error,
            },
            "expiring one held booking failed",
          );
        }
      }
    },
  };
}
