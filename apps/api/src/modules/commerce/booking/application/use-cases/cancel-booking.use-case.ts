import { AUDIT_ACTION } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE, BOOKING_STATUS } from "@banijjik/contracts/booking";
import type { BookingResponse } from "@banijjik/contracts/booking";
import type { BookingId, OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { recordNotFound } from "../../domain/errors.js";
import { assertLocationAllowed } from "../booking-transition-shared.js";
import { toBookingResponse } from "../booking-views.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceRepository,
  ResourceSlotUsagePort,
} from "../ports/booking-repositories.js";
import type { BookingEventPublisher } from "./create-booking.use-case.js";

export class CancelBookingUseCase {
  constructor(
    private readonly dependencies: {
      readonly bookings: BookingRepository;
      readonly resources: ResourceRepository;
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
    readonly reason: string;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<BookingResponse> {
    const existing = await this.dependencies.bookings.findById(input.bookingId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    const cancelled = existing.transition("cancel", {
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
      note: input.reason,
    });
    let persisted = cancelled;
    await this.dependencies.unitOfWork.run(async () => {
      if (
        existing.status === BOOKING_STATUS.HELD ||
        existing.status === BOOKING_STATUS.REQUESTED ||
        existing.status === BOOKING_STATUS.CONFIRMED ||
        existing.status === BOOKING_STATUS.CHECKED_IN
      ) {
        const resourceId = existing.resourceIds[0];
        if (resourceId !== undefined) {
          await this.dependencies.slots.releaseCapacity({
            organizationId: input.organizationId,
            resourceId,
            startsAt: existing.startsAt,
            blockedEndsAt: existing.blockedEndsAt,
          });
        }
      }
      persisted = await this.dependencies.bookings.update(cancelled, input.version);
      await this.dependencies.events.publish(
        BOOKING_EVENT_TYPE.BOOKING_CANCELLED,
        { bookingId: persisted.bookingId },
        { orderingKey: `booking:${persisted.bookingId}` },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.BOOKING_CANCELLED,
        entityType: "booking",
        entityId: persisted.bookingId,
        changes: { reason: { to: input.reason } },
      });
    });
    return toBookingResponse(persisted);
  }
}
