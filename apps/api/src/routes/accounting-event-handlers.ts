import { buildAuditRecorder } from "../modules/core/audit/index.js";
import { registerAccountingHandlers } from "../modules/commerce/accounting/index.js";
import { buildBookingPostingSourceAdapter } from "../modules/commerce/booking/index.js";
import { buildCommissionPostingSourceAdapter } from "../modules/commerce/commission/index.js";
import {
  buildExpensePostingSourceAdapter,
  registerExpenseEventHandlers,
} from "../modules/commerce/expense/index.js";
import { buildPaymentPostingSourceAdapter } from "../modules/commerce/payment/index.js";
import { systemClock } from "../kernel/time/index.js";
import { buildPaymentRequestReaders } from "./payment-request-readers.js";

/** Registers accounting, expense, booking and payment event handlers for the worker role. */
export function registerAccountingAndExpenseHandlers(): void {
  const audit = buildAuditRecorder(systemClock);
  registerExpenseEventHandlers(systemClock);

  const requestReaders = buildPaymentRequestReaders();

  registerAccountingHandlers({
    clock: systemClock,
    audit,
    expenses: buildExpensePostingSourceAdapter(),
    bookings: buildBookingPostingSourceAdapter(),
    payments: buildPaymentPostingSourceAdapter(requestReaders),
    commissions: buildCommissionPostingSourceAdapter(),
  });
}
