import { AUDIT_ACTION } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE } from "@banijjik/contracts/booking";
import type { BookingId, OrganizationId, ResourceId } from "@banijjik/ids";
import { Booking } from "../domain/booking.entity.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceSlotUsagePort,
} from "./ports/booking-repositories.js";
import type { BookingEventPublisher } from "./use-cases/create-booking.use-case.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";

export async function persistRescheduleInTxn(input: {
  dependencies: {
    bookings: BookingRepository;
    slots: ResourceSlotUsagePort;
    unitOfWork: BookingUnitOfWork;
    events: BookingEventPublisher;
    audit: AuditRecorder;
  };
  organizationId: OrganizationId;
  bookingId: BookingId;
  version: number;
  existing: Booking;
  updated: Booking;
  resource: { resourceId: ResourceId; capacity: number };
  startsAt: Date;
  blockedEndsAt: Date;
}): Promise<Booking> {
  let persisted = input.updated;
  await input.dependencies.unitOfWork.run(async () => {
    const oldResourceId = input.existing.resourceIds[0];
    if (oldResourceId !== undefined) {
      await input.dependencies.slots.releaseCapacity({
        organizationId: input.organizationId,
        resourceId: oldResourceId,
        startsAt: input.existing.startsAt,
        blockedEndsAt: input.existing.blockedEndsAt,
      });
    }
    await input.dependencies.slots.takeCapacity({
      organizationId: input.organizationId,
      resourceId: input.resource.resourceId,
      capacity: input.resource.capacity,
      startsAt: input.startsAt,
      blockedEndsAt: input.blockedEndsAt,
    });
    persisted = await input.dependencies.bookings.update(input.updated, input.version);
    await input.dependencies.events.publish(
      BOOKING_EVENT_TYPE.BOOKING_RESCHEDULED,
      { bookingId: persisted.bookingId },
      { orderingKey: `booking:${persisted.bookingId}` },
    );
    await input.dependencies.audit.record({
      action: AUDIT_ACTION.BOOKING_RESCHEDULED,
      entityType: "booking",
      entityId: persisted.bookingId,
      changes: {
        startsAt: {
          from: input.existing.startsAt.toISOString(),
          to: input.startsAt.toISOString(),
        },
      },
    });
  });
  return persisted;
}
