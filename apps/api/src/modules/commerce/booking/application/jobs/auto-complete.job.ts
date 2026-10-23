import { AUDIT_ACTION, MODULE_KEY, type ModuleManifest } from "@banijjik/contracts";
import {
  BOOKING_COMPLETE_GRACE_MINUTES_DEFAULT,
  BOOKING_EVENT_TYPE,
} from "@banijjik/contracts/booking";
import type { ScheduledJob } from "../../../../../kernel/jobs/index.js";
import { getLogger } from "../../../../../kernel/logger/index.js";
import { asId, type OrganizationId } from "@banijjik/ids";
import { buildBookingSettingsReader } from "../booking-settings-reader.js";
import type { Booking } from "../../domain/booking.entity.js";
import type { BookingRepository, BookingUnitOfWork } from "../ports/booking-repositories.js";
import type { BookingEventPublisher } from "../use-cases/create-booking.use-case.js";
import type { OrgConfigService } from "../../../../platform/entitlement/index.js";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";

export interface AutoCompleteJobDependencies {
  readonly bookings: BookingRepository;
  readonly unitOfWork: BookingUnitOfWork;
  readonly events: BookingEventPublisher;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

async function completeOneCandidate(opts: {
  readonly input: AutoCompleteJobDependencies;
  readonly row: Booking;
  readonly now: Date;
}): Promise<void> {
  const { input, row, now } = opts;
  await input.unitOfWork.run(async () => {
    const next = row.transition("complete", {
      now,
      actorUserId: null,
    });
    await input.bookings.update(next, row.version);
    await input.events.publish(
      BOOKING_EVENT_TYPE.BOOKING_COMPLETED,
      { bookingId: row.bookingId },
      { orderingKey: `booking:${row.bookingId}` },
    );
    await input.audit.record({
      action: AUDIT_ACTION.BOOKING_COMPLETED,
      entityType: "booking",
      entityId: row.bookingId,
      changes: {},
    });
  });
}

export function buildAutoCompleteJob(input: AutoCompleteJobDependencies): ScheduledJob {
  const settings = buildBookingSettingsReader({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  return {
    jobKey: "booking.autoComplete",
    everyMinutes: 5,
    moduleKey: MODULE_KEY.BOOKING,
    run: async (organizationId, now) => {
      const orgSettings = await settings.read(asId<OrganizationId>(organizationId));
      const graceMinutes =
        orgSettings.completeGraceMinutes ?? BOOKING_COMPLETE_GRACE_MINUTES_DEFAULT;
      const candidates = await input.bookings.listAutoCompleteCandidates({
        now,
        graceMinutes,
      });
      for (const row of candidates) {
        try {
          await completeOneCandidate({ input, row, now });
        } catch (error) {
          getLogger().error(
            {
              event: "booking.auto_complete_failed",
              organizationId,
              bookingId: row.bookingId,
              err: error,
            },
            "auto-completing one booking failed",
          );
        }
      }
    },
  };
}
