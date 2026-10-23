import { BOOKING_STATUS } from "@banijjik/contracts/booking";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { asId, type BookingId, type OrganizationId } from "@banijjik/ids";
import type { RequestAdvanceReader } from "../../payment/index.js";
import type { BookingPostingSnapshot, BookingPostingSource } from "../../accounting/index.js";
import type { Booking } from "../domain/booking.entity.js";
import { businessDateOf } from "../domain/timezone.js";
import type { BookingRepository } from "./ports/booking-repositories.js";

/**
 * The instant whose organization-local day the entry is posted on (ADR-124 note, 11 §10):
 * completed revenue is earned when the service ends; a cancellation-fee or no-show entry is
 * dated by the status change. Every transition writes `updatedAt` with that instant and both
 * statuses are terminal, so nothing re-dates them afterwards. (`history[]` cannot be used:
 * only reschedules append entries, so a cancelled booking has none - lead decision 3.25.)
 */
function postingInstant(booking: Booking): Date {
  if (booking.status === BOOKING_STATUS.COMPLETED) return booking.endsAt;
  return booking.updatedAt;
}

export function buildBookingPostingSource(input: {
  readonly bookings: Pick<BookingRepository, "findById">;
  readonly advances: Pick<RequestAdvanceReader, "readHeldAdvance">;
  readonly timeZone: { read(organizationId: OrganizationId): Promise<string> };
}): BookingPostingSource {
  return {
    async readBooking(bookingId: string): Promise<BookingPostingSnapshot | undefined> {
      const booking = await input.bookings.findById(asId<BookingId>(bookingId));
      if (booking === undefined) return undefined;
      const timeZone = await input.timeZone.read(booking.organizationId);
      return {
        bookingId: booking.bookingId,
        businessDate: businessDateOf(postingInstant(booking), timeZone),
        locationId: booking.locationId,
        // Each kind posts to its own revenue account (11 §10): a rental is not service revenue.
        kind: booking.kind,
        revenueExcludingTax: {
          amount: booking.price.total.amount - booking.price.tax.amount,
          currency: booking.price.currency,
        },
        tax: booking.price.tax,
        // Settle what the customer actually paid before revenue, never the required deposit:
        // unpaid deposit money is not in CUSTOMER_ADVANCES, an overpayment is (3.25 decision 2).
        advancesToSettle: await input.advances.readHeldAdvance({
          organizationId: booking.organizationId,
          requestType: PAYMENT_REQUEST_TYPE.BOOKING,
          requestId: booking.bookingId,
        }),
        ...(booking.cancellationFeeRetained
          ? { cancellationFeeRetained: booking.cancellationFeeRetained }
          : {}),
      };
    },
  };
}
