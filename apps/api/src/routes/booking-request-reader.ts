import { BOOKING_STATUS, type BookingStatus } from "@banijjik/contracts/booking";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { asId, type BookingId, type OrganizationId } from "@banijjik/ids";
import { buildBookingReader } from "../modules/commerce/booking/index.js";
import type { RequestReader, RequestReadSnapshot } from "../modules/commerce/payment/index.js";

function isAcceptingPayments(
  booking: {
    readonly status: BookingStatus;
    readonly holdExpiresAt: Date | null;
    readonly cancellationFeeRetained?: { readonly amount: number } | null | undefined;
  },
  now: Date,
): boolean {
  if (booking.status === BOOKING_STATUS.EXPIRED || booking.status === BOOKING_STATUS.NO_SHOW) {
    return false;
  }
  if (booking.status === BOOKING_STATUS.CANCELLED) {
    const fee = booking.cancellationFeeRetained?.amount ?? 0;
    return fee > 0;
  }
  if (booking.status === BOOKING_STATUS.HELD) {
    if (booking.holdExpiresAt !== null && now.getTime() >= booking.holdExpiresAt.getTime()) {
      return false;
    }
  }
  return true;
}

export function buildBookingRequestReader(
  bookings: ReturnType<typeof buildBookingReader> = buildBookingReader(),
  now: () => Date = () => new Date(),
): RequestReader {
  return {
    async read(
      organizationId: OrganizationId,
      requestId: string,
    ): Promise<RequestReadSnapshot | undefined> {
      const booking = await bookings.findById(asId<BookingId>(requestId));
      if (!booking || booking.organizationId !== organizationId) return undefined;
      return {
        requestId: booking.bookingId,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        total: booking.price.total,
        revenueState:
          booking.status === BOOKING_STATUS.COMPLETED ? "AFTER_REVENUE" : "BEFORE_REVENUE",
        contactId: booking.contactId,
        locationId: booking.locationId,
        acceptsPayments: isAcceptingPayments(booking, now()),
        refundLimit: null,
      };
    },
  };
}
