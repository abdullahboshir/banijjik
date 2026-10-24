import { MODULE_KEY } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE } from "@banijjik/contracts/booking";
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
import { releaseBookingCapacity } from "../event-booking-parts.js";

export function buildExpireHoldsJob(input: {
  readonly bookings: BookingRepository;
  readonly slots: ResourceSlotUsagePort;
  readonly sessions: EventSessionRepository;
  readonly unitOfWork: BookingUnitOfWork;
  readonly events: BookingEventPublisher;
  readonly clock: Clock;
}): ScheduledJob {
  return {
    jobKey: "booking.expireHolds",
    everyMinutes: 1,
    moduleKey: MODULE_KEY.BOOKING,
    run: async (organizationId, now) => {
      const held = await input.bookings.listHeldExpired(now);
      for (const row of held) {
        try {
          await input.unitOfWork.run(async () => {
            await releaseBookingCapacity({
              booking: row,
              slots: input.slots,
              sessions: input.sessions,
            });
            const next = row.transition("expire", { now, actorUserId: null });
            await input.bookings.update(next, row.version);
            await input.events.publish(
              BOOKING_EVENT_TYPE.BOOKING_EXPIRED,
              { bookingId: row.bookingId },
              { orderingKey: `booking:${row.bookingId}` },
            );
          });
        } catch (error) {
          // One expired hold must not stop the rest of the batch.
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
