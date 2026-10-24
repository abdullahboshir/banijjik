import { AUDIT_ACTION } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE } from "@banijjik/contracts/booking";
import type { BookingId, OrganizationId } from "@banijjik/ids";
import { Booking } from "../domain/booking.entity.js";
import type { BookingRepository, BookingUnitOfWork } from "./ports/booking-repositories.js";
import type { BookingEventPublisher } from "./use-cases/create-booking.use-case.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";

export async function persistRescheduleInTxn(input: {
  dependencies: {
    bookings: BookingRepository;
    unitOfWork: BookingUnitOfWork;
    events: BookingEventPublisher;
    audit: AuditRecorder;
  };
  organizationId: OrganizationId;
  bookingId: BookingId;
  version: number;
  existing: Booking;
  updated: Booking;
  /** Moves what the booking holds: seats into the new session, or slot buckets onto the new resource. */
  moveCapacity: () => Promise<void>;
}): Promise<Booking> {
  let persisted = input.updated;
  await input.dependencies.unitOfWork.run(async () => {
    await input.moveCapacity();
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
          to: input.updated.startsAt.toISOString(),
        },
      },
    });
  });
  return persisted;
}
