import { buildAuditRecorder } from "../modules/core/audit/index.js";
import { registerAccountingHandlers } from "../modules/commerce/accounting/index.js";
import {
  buildExpensePostingSourceAdapter,
  registerExpenseEventHandlers,
} from "../modules/commerce/expense/index.js";
import { systemClock } from "../kernel/time/index.js";

/**
 * Registers accounting and expense event handlers. Payment and booking adapters are omitted until
 * those modules supply them (lead clarification for 3.8c).
 */
export function registerAccountingAndExpenseHandlers(): void {
  const audit = buildAuditRecorder(systemClock);
  registerExpenseEventHandlers(systemClock);
  registerAccountingHandlers({
    clock: systemClock,
    audit,
    expenses: buildExpensePostingSourceAdapter(),
  });
}
