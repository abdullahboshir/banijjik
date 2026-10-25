import { BOOKING_STATUS } from "@banijjik/contracts/booking";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { asId, type BookingId, type OrganizationId } from "@banijjik/ids";
import { buildBookingReader } from "../modules/commerce/booking/index.js";
import type { RequestReader, RequestReadSnapshot } from "../modules/commerce/payment/index.js";

export function buildBookingRequestReader(
  bookings: ReturnType<typeof buildBookingReader> = buildBookingReader(),
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
        acceptsPayments: true,
        refundLimit: null,
      };
    },
  };
}
