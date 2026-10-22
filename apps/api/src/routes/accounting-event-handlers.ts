import { buildAuditRecorder } from "../modules/core/audit/index.js";
import { registerAccountingHandlers } from "../modules/commerce/accounting/index.js";
import {
  buildBookingPostingSourceAdapter,
  MongoBookingRepository,
} from "../modules/commerce/booking/index.js";
import {
  buildExpensePostingSourceAdapter,
  registerExpenseEventHandlers,
} from "../modules/commerce/expense/index.js";
import {
  buildPaymentPostingSourceAdapter,
  RequestReaderRegistry,
} from "../modules/commerce/payment/index.js";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { asId, type BookingId, type OrganizationId } from "@banijjik/ids";
import { systemClock } from "../kernel/time/index.js";

/** Registers accounting, expense, booking and payment event handlers for the worker role. */
export function registerAccountingAndExpenseHandlers(): void {
  const audit = buildAuditRecorder(systemClock);
  registerExpenseEventHandlers(systemClock);

  const requestReaders = new RequestReaderRegistry();
  const bookings = new MongoBookingRepository();
  requestReaders.register(PAYMENT_REQUEST_TYPE.BOOKING, {
    async read(organizationId: OrganizationId, requestId: string) {
      const booking = await bookings.findById(asId<BookingId>(requestId));
      if (!booking || booking.organizationId !== organizationId) return undefined;
      return {
        requestId: booking.bookingId,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        total: booking.price.total,
        revenueState: booking.status === "COMPLETED" ? "AFTER_REVENUE" : "BEFORE_REVENUE",
        contactId: booking.contactId,
        locationId: booking.locationId,
      };
    },
  });

  registerAccountingHandlers({
    clock: systemClock,
    audit,
    expenses: buildExpensePostingSourceAdapter(),
    bookings: buildBookingPostingSourceAdapter(),
    payments: buildPaymentPostingSourceAdapter(requestReaders),
  });
}
