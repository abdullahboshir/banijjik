import { MODULE_KEY } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE } from "@banijjik/contracts/booking";
import type { BookingEventPublisher } from "../use-cases/create-booking.use-case.js";
import type { ScheduledJob } from "../../../../../kernel/jobs/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceSlotUsagePort,
} from "../ports/booking-repositories.js";
export function buildExpireHoldsJob(input: {
  readonly bookings: BookingRepository;
  readonly slots: ResourceSlotUsagePort;
  readonly unitOfWork: BookingUnitOfWork;
  readonly events: BookingEventPublisher;
  readonly clock: Clock;
}): ScheduledJob {
  return {
    jobKey: "booking.expireHolds",
    everyMinutes: 1,
    moduleKey: MODULE_KEY.BOOKING,
    run: async (_organizationId, now) => {
      const held = await input.bookings.listHeldExpired(now);
      for (const row of held) {
        const resourceId = row.resourceIds[0];
        if (resourceId === undefined) continue;
        await input.unitOfWork.run(async () => {
          await input.slots.releaseCapacity({
            organizationId: row.organizationId,
            resourceId,
            startsAt: row.startsAt,
            blockedEndsAt: row.blockedEndsAt,
          });
          const next = row.transition("expire", { now, actorUserId: null });
          await input.bookings.update(next, row.version);
          await input.events.publish(
            BOOKING_EVENT_TYPE.BOOKING_EXPIRED,
            { bookingId: row.bookingId },
            { orderingKey: `booking:${row.bookingId}` },
          );
        });
      }
    },
  };
}
