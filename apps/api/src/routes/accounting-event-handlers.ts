import { buildAuditRecorder } from "../modules/core/audit/index.js";
import { registerAccountingHandlers } from "../modules/commerce/accounting/index.js";
import { buildBookingPostingSourceAdapter } from "../modules/commerce/booking/index.js";
import {
  buildExpensePostingSourceAdapter,
  registerExpenseEventHandlers,
} from "../modules/commerce/expense/index.js";
import { systemClock } from "../kernel/time/index.js";

/** Registers accounting, expense and booking event handlers for the worker role. */
export function registerAccountingAndExpenseHandlers(): void {
  const audit = buildAuditRecorder(systemClock);
  registerExpenseEventHandlers(systemClock);
  registerAccountingHandlers({
    clock: systemClock,
    audit,
    expenses: buildExpensePostingSourceAdapter(),
    bookings: buildBookingPostingSourceAdapter(),
  });
}
