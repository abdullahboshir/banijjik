import type { BookingPostingSnapshot } from "../../accounting/index.js";
import type { BookingPostingSource } from "../../accounting/index.js";
import { asId, type BookingId } from "@banijjik/ids";
import type { BookingRepository } from "./ports/booking-repositories.js";

export function buildBookingPostingSource(input: {
  readonly bookings: BookingRepository;
}): BookingPostingSource {
  return {
    async readBooking(bookingId: string): Promise<BookingPostingSnapshot | undefined> {
      const booking = await input.bookings.findById(asId<BookingId>(bookingId));
      if (booking === undefined) return undefined;
      return {
        bookingId: booking.bookingId,
        businessDate: booking.startsAt.toISOString().slice(0, 10),
        locationId: booking.locationId,
        kind: "SERVICE",
        revenueExcludingTax: {
          amount: booking.price.total.amount - booking.price.tax.amount,
          currency: booking.price.currency,
        },
        tax: booking.price.tax,
        advancesToSettle: booking.depositRequired,
        ...(booking.cancellationFeeRetained
          ? { cancellationFeeRetained: booking.cancellationFeeRetained }
          : {}),
      };
    },
  };
}
