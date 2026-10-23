import { MODULE_KEY } from "@banijjik/contracts";
import {
  BOOKING_EVENT_TYPE,
  BOOKING_FREE_CANCEL_HOURS_DEFAULT,
  BOOKING_NO_SHOW_FEE_DEFAULT,
  BOOKING_TERMINATION_MODE,
} from "@banijjik/contracts/booking";
import type { ScheduledJob } from "../../../../../kernel/jobs/index.js";
import { getLogger } from "../../../../../kernel/logger/index.js";
import type { OrganizationId, ResourceId } from "@banijjik/ids";
import { buildBookingSettingsReader } from "../booking-settings-reader.js";
import type { BookingSettings } from "../ports/booking-context-ports.js";
import type { Booking } from "../../domain/booking.entity.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceSlotUsagePort,
} from "../ports/booking-repositories.js";
import type { DepositCheckPort } from "../ports/payment-ports.js";
import type { BookingEventPublisher } from "../use-cases/create-booking.use-case.js";
import type { OrgConfigService } from "../../../../platform/entitlement/index.js";
import type { ModuleManifest } from "@banijjik/contracts";

interface MarkNoShowsDependencies {
  readonly bookings: BookingRepository;
  readonly slots: ResourceSlotUsagePort;
  readonly unitOfWork: BookingUnitOfWork;
  readonly events: BookingEventPublisher;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly depositCheck: DepositCheckPort;
}

async function settleCandidateNoShow(opts: {
  readonly input: MarkNoShowsDependencies;
  readonly row: Booking;
  readonly orgSettings: BookingSettings;
  readonly now: Date;
  readonly resourceId: ResourceId;
}): Promise<void> {
  const { input, row, orgSettings, now, resourceId } = opts;
  await input.unitOfWork.run(async () => {
    await input.slots.releaseCapacity({
      organizationId: row.organizationId,
      resourceId,
      startsAt: row.startsAt,
      blockedEndsAt: row.blockedEndsAt,
    });
    const freeCancelHours = orgSettings.freeCancelHours ?? BOOKING_FREE_CANCEL_HOURS_DEFAULT;
    const feeMode = orgSettings.noShowFee ?? BOOKING_NO_SHOW_FEE_DEFAULT;
    const feePercent = orgSettings.feePercent ?? orgSettings.depositValue;
    const settlement = await input.depositCheck.settleBookingTermination({
      organizationId: row.organizationId,
      requestId: row.bookingId,
      contactId: row.contactId,
      locationId: row.locationId,
      startsAt: row.startsAt,
      depositRequired: row.depositRequired,
      priceTotal: row.price.total,
      mode: BOOKING_TERMINATION_MODE.NO_SHOW,
      freeCancelHours,
      feeMode,
      feePercent,
      actorUserId: null,
      now,
    });
    const next = row.transition("noShow", {
      now,
      actorUserId: null,
      cancellationFeeRetained: settlement?.feeRetained ?? null,
    });
    await input.bookings.update(next, row.version);
    await input.events.publish(
      BOOKING_EVENT_TYPE.BOOKING_NO_SHOW_MARKED,
      { bookingId: row.bookingId },
      { orderingKey: `booking:${row.bookingId}` },
    );
  });
}

export function buildMarkNoShowsJob(input: MarkNoShowsDependencies): ScheduledJob {
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
        try {
          await settleCandidateNoShow({ input, row, orgSettings, now, resourceId });
        } catch (error) {
          // One failing booking (or a 409 from a staff edit meanwhile) must not stop the others.
          getLogger().error(
            {
              event: "booking.mark_no_show_failed",
              organizationId,
              bookingId: row.bookingId,
              err: error,
            },
            "marking one booking as no-show failed",
          );
        }
      }
    },
  };
}
