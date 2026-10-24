import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { OrganizationCurrencyPort } from "./application/organization-currency.js";
import { buildExpenseAccountWriter } from "./application/ensure-expense-account.js";
import type { BookingPostingSource } from "./application/ports/booking-posting-source.js";
import type { CommissionPostingSource } from "./application/ports/commission-posting-source.js";
import type { OrderPostingSource } from "./application/ports/order-posting-source.js";
import type { EnrollmentPeriodPostingSource } from "./application/ports/enrollment-posting-source.js";
import type { SalesReturnPostingSource } from "./application/ports/sales-return-posting-source.js";
import type { StockPostingSource } from "./application/ports/stock-posting-source.js";
import type { ExpenseAccountWriter } from "./application/ports/expense-account-writer.js";
import type { ExpensePostingSource } from "./application/ports/expense-posting-source.js";
import type { PaymentPostingSource } from "./application/ports/payment-posting-source.js";
import { buildPostBookingsHandler } from "./application/handlers/post-bookings.handler.js";
import { buildPostPaymentsHandler } from "./application/handlers/post-payments.handler.js";
import { buildPostOrdersHandler } from "./application/handlers/post-orders.handler.js";
import { buildPostSalesReturnsHandler } from "./application/handlers/post-sales-returns.handler.js";
import { buildPostStockHandler } from "./application/handlers/post-stock.handler.js";
import { buildPostEnrollmentsHandler } from "./application/handlers/post-enrollments.handler.js";
import { registerAccountingEventHandlers } from "./application/register-handlers.js";
import { catchUpSystemAccounts, seedSystemAccounts } from "./application/seed-system-accounts.js";
import { GetTrialBalanceUseCase } from "./application/use-cases/get-trial-balance.use-case.js";
import { ListAccountsUseCase } from "./application/use-cases/list-accounts.use-case.js";
import { ListJournalUseCase } from "./application/use-cases/list-journal.use-case.js";
import { MongoAccountRepository } from "./infrastructure/mongo-account.repository.js";
import { MongoJournalRepository } from "./infrastructure/mongo-journal.repository.js";
import { AccountingController } from "./presentation/accounting.controller.js";
import { buildAccountingTenantRouter } from "./presentation/accounting-tenant.router.js";

export { accountingManifest } from "./module.manifest.js";
export { registerAccountingModels } from "./infrastructure/register-accounting-models.js";
export type { OrganizationCurrencyPort } from "./application/organization-currency.js";
export type { PaymentPostingSource } from "./application/ports/payment-posting-source.js";
export type { BookingPostingSource } from "./application/ports/booking-posting-source.js";
export type { ExpensePostingSource } from "./application/ports/expense-posting-source.js";
export type { CommissionPostingSource } from "./application/ports/commission-posting-source.js";
export type { OrderPostingSource } from "./application/ports/order-posting-source.js";
export type {
  EnrollmentPeriodPostingSnapshot,
  EnrollmentPeriodPostingSource,
} from "./application/ports/enrollment-posting-source.js";
export type { SalesReturnPostingSource } from "./application/ports/sales-return-posting-source.js";
export type { SalesReturnPostingSnapshot } from "./domain/sales-return-posting-rules.js";
export type { StockPostingSource } from "./application/ports/stock-posting-source.js";
export type { ExpenseAccountWriter } from "./application/ports/expense-account-writer.js";
export type {
  PaymentAllocationForPosting,
  PaymentMethodCode,
  PaymentPostingSnapshot,
  PaymentWriteOffForPosting,
  StoreCreditPostingSnapshot,
  BookingPostingSnapshot,
  ExpensePostingSnapshot,
} from "./domain/posting-rules.js";
export type { OrderPostingSnapshot } from "./domain/order-posting-rules.js";
export type {
  StockMovementPostingLine,
  StockPostingSnapshot,
} from "./domain/stock-posting-rules.js";
export { seedSystemAccounts, catchUpSystemAccounts };
export {
  draftPaymentReceived,
  draftPaymentRefund,
  draftStoreCreditExpiry,
  draftBookingCompleted,
  draftCancellationFee,
  draftExpensePosted,
  draftExpenseVoided,
} from "./domain/posting-rules.js";
export { draftBadDebtWriteOff } from "./domain/write-off-posting-rules.js";
export { draftOrderCompleted } from "./domain/order-posting-rules.js";
export { draftStockSource } from "./domain/stock-posting-rules.js";
export { assertBalanced, mirrorLines } from "./domain/journal-lines.js";
export { postJournalEntry, postReversal } from "./application/post-journal.js";
export {
  buildPostBookingsHandler,
  buildPostPaymentsHandler,
  buildPostOrdersHandler,
  buildPostSalesReturnsHandler,
  buildPostStockHandler,
  buildPostEnrollmentsHandler,
};
export { Account } from "./domain/account.entity.js";
export { JournalEntry } from "./domain/journal-entry.entity.js";
export { MongoAccountRepository } from "./infrastructure/mongo-account.repository.js";
export { MongoJournalRepository } from "./infrastructure/mongo-journal.repository.js";
export type { AccountRepository } from "./application/ports/account-repository.js";
export type { JournalRepository } from "./application/ports/journal-repository.js";

export interface AccountingTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly currencies: OrganizationCurrencyPort;
}

export function buildAccountingRouter(dependencies: AccountingTenantDependencies): Router {
  const accounts = new MongoAccountRepository();
  const journals = new MongoJournalRepository();
  const controller = new AccountingController({
    listAccounts: new ListAccountsUseCase(accounts),
    listJournal: new ListJournalUseCase(journals),
    getTrialBalance: new GetTrialBalanceUseCase(accounts, journals, dependencies.currencies),
  });
  return buildAccountingTenantRouter({
    controller,
    permission: dependencies.permission,
  });
}

/** Expense categories create their EXPENSE accounts through this writer (import via index only). */
export function buildAccountingExpenseAccountWriter(clock: Clock): ExpenseAccountWriter {
  return buildExpenseAccountWriter({
    accounts: new MongoAccountRepository(),
    clock,
  });
}

export interface AccountingEventHandlerInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly expenses: ExpensePostingSource;
  readonly payments?: PaymentPostingSource | undefined;
  readonly bookings?: BookingPostingSource | undefined;
  readonly commissions?: CommissionPostingSource | undefined;
  readonly orders?: OrderPostingSource | undefined;
  readonly salesReturns: SalesReturnPostingSource;
  readonly stocks?: StockPostingSource | undefined;
  readonly enrollments: EnrollmentPeriodPostingSource;
}

/** Registers accounting handlers. Payment/booking/order/stock adapters are optional (lead clarification). */
export function registerAccountingHandlers(input: AccountingEventHandlerInput): void {
  registerAccountingEventHandlers({
    accounts: new MongoAccountRepository(),
    journals: new MongoJournalRepository(),
    events: kernelEventPublisher,
    audit: input.audit,
    clock: input.clock,
    expenses: input.expenses,
    enrollments: input.enrollments,
    ...(input.payments === undefined ? {} : { payments: input.payments }),
    ...(input.bookings === undefined ? {} : { bookings: input.bookings }),
    ...(input.commissions === undefined ? {} : { commissions: input.commissions }),
    ...(input.orders === undefined ? {} : { orders: input.orders }),
    salesReturns: input.salesReturns,
    ...(input.stocks === undefined ? {} : { stocks: input.stocks }),
  });
}

/** Unit of work helper for tests that post journals inside a transaction. */
export function accountingUnitOfWork(): MongoUnitOfWork {
  return new MongoUnitOfWork();
}

export { CreateAccountUseCase } from "./application/use-cases/create-account.use-case.js";
export { UpdateAccountUseCase } from "./application/use-cases/update-account.use-case.js";
export { PostManualEntryUseCase } from "./application/use-cases/post-manual-entry.use-case.js";
export { ReverseEntryUseCase } from "./application/use-cases/reverse-entry.use-case.js";
export { ProfitAndLossUseCase } from "./application/use-cases/profit-and-loss.use-case.js";
export { BalanceSheetUseCase } from "./application/use-cases/balance-sheet.use-case.js";

export { ListAccountsUseCase, ListJournalUseCase, GetTrialBalanceUseCase };

export { ListBookkeepingAccountsUseCase } from "./application/use-cases/list-bookkeeping-accounts.use-case.js";
export type {
  CommissionEntryPostingSnapshot,
  CommissionPayoutPostingSnapshot,
} from "./domain/commission-posting-rules.js";
export {
  draftCommissionEntryRecorded,
  draftCommissionPaid,
} from "./domain/commission-posting-rules.js";
