import { registerEventHandler } from "../../../../kernel/events/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { BookingPostingSource } from "./ports/booking-posting-source.js";
import type { CommissionPostingSource } from "./ports/commission-posting-source.js";
import type { ExpensePostingSource } from "./ports/expense-posting-source.js";
import type { PaymentPostingSource } from "./ports/payment-posting-source.js";
import type { AccountRepository } from "./ports/account-repository.js";
import type { JournalRepository } from "./ports/journal-repository.js";
import type { EventPublisher, PostJournalDependencies } from "./post-journal.js";
import { buildPostBookingsHandler } from "./handlers/post-bookings.handler.js";
import { buildPostCommissionHandler } from "./handlers/post-commission.handler.js";
import { buildPostExpensesHandler } from "./handlers/post-expenses.handler.js";
import { buildPostPaymentsHandler } from "./handlers/post-payments.handler.js";
import { buildSeedOnOrganizationCreatedHandler } from "./handlers/seed-on-organization-created.handler.js";

export interface AccountingHandlerDependencies {
  readonly accounts: AccountRepository;
  readonly journals: JournalRepository;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  /** When omitted, payment posting handlers are not registered (lead clarification). */
  readonly payments?: PaymentPostingSource | undefined;
  /** When omitted, booking posting handlers are not registered (lead clarification). */
  readonly bookings?: BookingPostingSource | undefined;
  /** When omitted, commission posting is not registered (the commission module is optional). */
  readonly commissions?: CommissionPostingSource | undefined;
  readonly expenses: ExpensePostingSource;
}

function postingOf(dependencies: AccountingHandlerDependencies): PostJournalDependencies {
  return {
    accounts: dependencies.accounts,
    journals: dependencies.journals,
    events: dependencies.events,
    audit: dependencies.audit,
    clock: dependencies.clock,
  };
}

/**
 * Registers accounting event handlers. Payment and booking streams register only when their
 * posting-source adapters are provided (cards 3.8 / 3.6 merge later).
 */
export function registerAccountingEventHandlers(dependencies: AccountingHandlerDependencies): void {
  registerEventHandler(
    buildSeedOnOrganizationCreatedHandler({
      accounts: dependencies.accounts,
      clock: dependencies.clock,
    }),
  );
  registerEventHandler(
    buildPostExpensesHandler({
      expenses: dependencies.expenses,
      posting: postingOf(dependencies),
    }),
  );
  if (dependencies.payments !== undefined) {
    registerEventHandler(
      buildPostPaymentsHandler({
        payments: dependencies.payments,
        posting: postingOf(dependencies),
      }),
    );
  }
  if (dependencies.bookings !== undefined) {
    registerEventHandler(
      buildPostBookingsHandler({
        bookings: dependencies.bookings,
        posting: postingOf(dependencies),
      }),
    );
  }
  if (dependencies.commissions !== undefined) {
    registerEventHandler(
      buildPostCommissionHandler({
        commissions: dependencies.commissions,
        posting: postingOf(dependencies),
      }),
    );
  }
}
