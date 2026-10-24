import { buildAuditRecorder } from "../modules/core/audit/index.js";
import { buildOrganizationCurrencyReader } from "../modules/core/organization/index.js";
import { registerAccountingHandlers } from "../modules/commerce/accounting/index.js";
import { buildBookingPostingSourceAdapter } from "../modules/commerce/booking/index.js";
import { buildCommissionPostingSourceAdapter } from "../modules/commerce/commission/index.js";
import {
  buildExpensePostingSourceAdapter,
  registerExpenseEventHandlers,
} from "../modules/commerce/expense/index.js";
import {
  buildPaymentPostingSourceAdapter,
  buildRequestAdvanceReader,
} from "../modules/commerce/payment/index.js";
import {
  buildInventoryPostingSourceAdapter,
  buildStockPostingSourceAdapter,
} from "../modules/commerce/inventory/index.js";
import {
  buildOrderPostingSourceAdapter,
  buildOrderRepository,
  buildSalesReturnPostingSourceAdapter,
  buildSalesReturnRepository,
} from "../modules/commerce/sales/index.js";
import { systemClock } from "../kernel/time/index.js";
import { buildEnrollmentPeriodPostingSource } from "../modules/commerce/enrollment/index.js";
import { buildPaymentRequestReaders } from "./payment-request-readers.js";

/** Registers accounting, expense, booking and payment event handlers for the worker role. */
export function registerAccountingAndExpenseHandlers(): void {
  const audit = buildAuditRecorder(systemClock);
  registerExpenseEventHandlers(systemClock);

  const requestReaders = buildPaymentRequestReaders();
  const currencies = buildOrganizationCurrencyReader();

  registerAccountingHandlers({
    clock: systemClock,
    audit,
    expenses: buildExpensePostingSourceAdapter(),
    bookings: buildBookingPostingSourceAdapter(),
    payments: buildPaymentPostingSourceAdapter(requestReaders),
    commissions: buildCommissionPostingSourceAdapter(),
    orders: buildOrderPostingSourceAdapter({
      orders: buildOrderRepository(),
      advances: buildRequestAdvanceReader(),
      inventory: buildInventoryPostingSourceAdapter(),
    }),
    salesReturns: buildSalesReturnPostingSourceAdapter({
      returns: buildSalesReturnRepository(),
      inventory: buildInventoryPostingSourceAdapter(),
      organizationCurrency: (organizationId) => currencies.read(organizationId),
    }),
    stocks: buildStockPostingSourceAdapter({ currencies }),
    enrollments: buildEnrollmentPeriodPostingSource(buildRequestAdvanceReader()),
  });
}
