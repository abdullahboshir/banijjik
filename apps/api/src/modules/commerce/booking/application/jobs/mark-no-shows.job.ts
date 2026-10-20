import { MODULE_KEY } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE } from "@banijjik/contracts/booking";
import type { ScheduledJob } from "../../../../../kernel/jobs/index.js";
import type { OrganizationId } from "@banijjik/ids";
import { buildBookingSettingsReader } from "../booking-settings-reader.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceSlotUsagePort,
} from "../ports/booking-repositories.js";
import type { BookingEventPublisher } from "../use-cases/create-booking.use-case.js";
import type { OrgConfigService } from "../../../../platform/entitlement/index.js";
import type { ModuleManifest } from "@banijjik/contracts";

export function buildMarkNoShowsJob(input: {
  readonly bookings: BookingRepository;
  readonly slots: ResourceSlotUsagePort;
  readonly unitOfWork: BookingUnitOfWork;
  readonly events: BookingEventPublisher;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}): ScheduledJob {
  const settings = buildBookingSettingsReader({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  return {
    jobKey: "booking.markNoShows",
    everyMinutes: 5,
    moduleKey: MODULE_KEY.BOOKING,
    run: async (organizationId, now) => {
      const orgSettings = await settings.read(organizationId as OrganizationId);
      const candidates = await input.bookings.listNoShowCandidates({
        now,
        graceMinutes: orgSettings.noShowAfterMinutes,
      });
      for (const row of candidates) {
        const resourceId = row.resourceIds[0];
        if (resourceId === undefined) continue;
        await input.unitOfWork.run(async () => {
          await input.slots.releaseCapacity({
            organizationId: row.organizationId,
            resourceId,
            startsAt: row.startsAt,
            blockedEndsAt: row.blockedEndsAt,
          });
          const next = row.transition("noShow", { now, actorUserId: null });
          await input.bookings.update(next, row.version);
          await input.events.publish(
            BOOKING_EVENT_TYPE.BOOKING_NO_SHOW_MARKED,
            { bookingId: row.bookingId },
            { orderingKey: `booking:${row.bookingId}` },
          );
        });
      }
    },
  };
}
