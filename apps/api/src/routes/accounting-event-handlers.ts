import { buildAuditRecorder } from "../modules/core/audit/index.js";
import { registerAccountingHandlers } from "../modules/commerce/accounting/index.js";
import { buildBookingPostingSourceAdapter } from "../modules/commerce/booking/index.js";
import { buildCommissionPostingSourceAdapter } from "../modules/commerce/commission/index.js";
import {
  buildExpensePostingSourceAdapter,
  registerExpenseEventHandlers,
} from "../modules/commerce/expense/index.js";
import {
  buildPaymentPostingSourceAdapter,
  RequestReaderRegistry,
} from "../modules/commerce/payment/index.js";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { systemClock } from "../kernel/time/index.js";
import { buildBookingRequestReader } from "./booking-request-reader.js";

/** Registers accounting, expense, booking and payment event handlers for the worker role. */
export function registerAccountingAndExpenseHandlers(): void {
  const audit = buildAuditRecorder(systemClock);
  registerExpenseEventHandlers(systemClock);

  const requestReaders = new RequestReaderRegistry();
  requestReaders.register(PAYMENT_REQUEST_TYPE.BOOKING, buildBookingRequestReader());

  registerAccountingHandlers({
    clock: systemClock,
    audit,
    expenses: buildExpensePostingSourceAdapter(),
    bookings: buildBookingPostingSourceAdapter(),
    payments: buildPaymentPostingSourceAdapter(requestReaders),
    commissions: buildCommissionPostingSourceAdapter(),
  });
}
