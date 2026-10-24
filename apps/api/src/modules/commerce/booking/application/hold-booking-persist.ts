import { AUDIT_ACTION } from "@banijjik/contracts";
import { BOOKING_EVENT_TYPE } from "@banijjik/contracts/booking";
import type { BookingResponse } from "@banijjik/contracts/booking";
import type { OrganizationId } from "@banijjik/ids";
import { Booking } from "../domain/booking.entity.js";
import { toBookingResponse } from "./booking-views.js";
import type { HoldBookingDependencies } from "./use-cases/hold-booking.use-case.js";

function orderingKey(bookingId: string): string {
  return `booking:${bookingId}`;
}

export async function persistHoldBooking(input: {
  dependencies: HoldBookingDependencies;
  organizationId: OrganizationId;
  booking: Booking;
  /** Takes the capacity the hold was priced for; runs inside the hold transaction. */
  reserveCapacity: () => Promise<void>;
}): Promise<BookingResponse> {
  await input.dependencies.unitOfWork.run(async () => {
    await input.reserveCapacity();
    await input.dependencies.bookings.insert(input.booking);
    await input.dependencies.events.publish(
      BOOKING_EVENT_TYPE.BOOKING_HELD,
      { bookingId: input.booking.bookingId },
      { orderingKey: orderingKey(input.booking.bookingId) },
    );
    await input.dependencies.audit.record({
      action: AUDIT_ACTION.BOOKING_CREATED,
      entityType: "booking",
      entityId: input.booking.bookingId,
      changes: { status: { to: input.booking.status } },
    });
  });
  return toBookingResponse(input.booking);
}
