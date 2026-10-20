import { AUDIT_ACTION } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE, BOOKING_STATUS } from "@banijjik/contracts/booking";
import type { BookingResponse } from "@banijjik/contracts/booking";
import type { BookingId, OrganizationId, ResourceId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import { Booking } from "../domain/booking.entity.js";
import { toBookingResponse } from "./booking-views.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceSlotUsagePort,
} from "./ports/booking-repositories.js";
import type { BookingEventPublisher } from "./use-cases/create-booking.use-case.js";

function orderingKey(bookingId: BookingId): string {
  return `booking:${bookingId}`;
}

export async function persistCreatedBooking(input: {
  dependencies: {
    readonly bookings: BookingRepository;
    readonly slots: ResourceSlotUsagePort;
    readonly unitOfWork: BookingUnitOfWork;
    readonly events: BookingEventPublisher;
    readonly audit: AuditRecorder;
  };
  organizationId: OrganizationId;
  resourceId: ResourceId;
  resourceCapacity: number;
  booking: Booking;
  status: typeof BOOKING_STATUS.REQUESTED | typeof BOOKING_STATUS.CONFIRMED;
}): Promise<BookingResponse> {
  await input.dependencies.unitOfWork.run(async () => {
    await input.dependencies.slots.takeCapacity({
      organizationId: input.organizationId,
      resourceId: input.resourceId,
      capacity: input.resourceCapacity,
      startsAt: input.booking.startsAt,
      blockedEndsAt: input.booking.blockedEndsAt,
    });
    await input.dependencies.bookings.insert(input.booking);
    const eventType =
      input.status === BOOKING_STATUS.REQUESTED
        ? BOOKING_EVENT_TYPE.BOOKING_REQUESTED
        : BOOKING_EVENT_TYPE.BOOKING_CONFIRMED;
    await input.dependencies.events.publish(
      eventType,
      { bookingId: input.booking.bookingId },
      { orderingKey: orderingKey(input.booking.bookingId) },
    );
    await input.dependencies.audit.record({
      action: AUDIT_ACTION.BOOKING_CREATED,
      entityType: "booking",
      entityId: input.booking.bookingId,
      changes: { bookingNumber: { to: input.booking.bookingNumber } },
    });
  });
  return toBookingResponse(input.booking);
}
