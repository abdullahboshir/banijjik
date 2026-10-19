import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { buildExpenseAccountWriter } from "./application/ensure-expense-account.js";
import type { BookingPostingSource } from "./application/ports/booking-posting-source.js";
import type { ExpenseAccountWriter } from "./application/ports/expense-account-writer.js";
import type { ExpensePostingSource } from "./application/ports/expense-posting-source.js";
import type { PaymentPostingSource } from "./application/ports/payment-posting-source.js";
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
export type { PaymentPostingSource } from "./application/ports/payment-posting-source.js";
export type { BookingPostingSource } from "./application/ports/booking-posting-source.js";
export type { ExpensePostingSource } from "./application/ports/expense-posting-source.js";
export type { ExpenseAccountWriter } from "./application/ports/expense-account-writer.js";
export type {
  PaymentPostingSnapshot,
  StoreCreditPostingSnapshot,
  BookingPostingSnapshot,
  ExpensePostingSnapshot,
} from "./domain/posting-rules.js";
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
export { assertBalanced, mirrorLines } from "./domain/journal-lines.js";
export { postJournalEntry, postReversal } from "./application/post-journal.js";
export { Account } from "./domain/account.entity.js";
export { JournalEntry } from "./domain/journal-entry.entity.js";
export { MongoAccountRepository } from "./infrastructure/mongo-account.repository.js";
export { MongoJournalRepository } from "./infrastructure/mongo-journal.repository.js";

export interface AccountingTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
}

export function buildAccountingRouter(dependencies: AccountingTenantDependencies): Router {
  const accounts = new MongoAccountRepository();
  const journals = new MongoJournalRepository();
  const controller = new AccountingController({
    listAccounts: new ListAccountsUseCase(accounts),
    listJournal: new ListJournalUseCase(journals),
    getTrialBalance: new GetTrialBalanceUseCase(accounts, journals),
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
}

/** Registers accounting handlers. Payment/booking adapters are optional (lead clarification). */
export function registerAccountingHandlers(input: AccountingEventHandlerInput): void {
  registerAccountingEventHandlers({
    accounts: new MongoAccountRepository(),
    journals: new MongoJournalRepository(),
    events: kernelEventPublisher,
    audit: input.audit,
    clock: input.clock,
    expenses: input.expenses,
    ...(input.payments === undefined ? {} : { payments: input.payments }),
    ...(input.bookings === undefined ? {} : { bookings: input.bookings }),
  });
}

/** Unit of work helper for tests that post journals inside a transaction. */
export function accountingUnitOfWork(): MongoUnitOfWork {
  return new MongoUnitOfWork();
}
