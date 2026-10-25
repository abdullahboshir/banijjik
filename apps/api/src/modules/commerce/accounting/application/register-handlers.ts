import { registerEventHandler } from "../../../../kernel/events/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { BookingPostingSource } from "./ports/booking-posting-source.js";
import type { CommissionPostingSource } from "./ports/commission-posting-source.js";
import type { ExpensePostingSource } from "./ports/expense-posting-source.js";
import type { PaymentPostingSource } from "./ports/payment-posting-source.js";
import type { OrderPostingSource } from "./ports/order-posting-source.js";
import type { EnrollmentPeriodPostingSource } from "./ports/enrollment-posting-source.js";
import type { StockPostingSource } from "./ports/stock-posting-source.js";
import type { AccountRepository } from "./ports/account-repository.js";
import type { JournalRepository } from "./ports/journal-repository.js";
import type { EventPublisher, PostJournalDependencies } from "./post-journal.js";
import { buildPostBookingsHandler } from "./handlers/post-bookings.handler.js";
import { buildPostCommissionHandler } from "./handlers/post-commission.handler.js";
import { buildPostExpensesHandler } from "./handlers/post-expenses.handler.js";
import { buildPostPaymentsHandler } from "./handlers/post-payments.handler.js";
import { buildPostOrdersHandler } from "./handlers/post-orders.handler.js";
import { buildPostEnrollmentsHandler } from "./handlers/post-enrollments.handler.js";
import { buildPostSalesReturnsHandler } from "./handlers/post-sales-returns.handler.js";
import type { SalesReturnPostingSource } from "./ports/sales-return-posting-source.js";
import { buildPostStockHandler } from "./handlers/post-stock.handler.js";
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
  readonly orders?: OrderPostingSource | undefined;
  /** Required: a return that is not posted would leave the books short (plan 3.5b decision 9). */
  readonly salesReturns: SalesReturnPostingSource;
  readonly stocks?: StockPostingSource | undefined;
  readonly expenses: ExpensePostingSource;
  /** Required: enrollment periods post revenue whenever the enrollment module emits them (card 3.31). */
  readonly enrollments: EnrollmentPeriodPostingSource;
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
  registerRequiredHandlers(dependencies);
  registerOptionalHandlers(dependencies);
}

/** Streams whose posting sources are always wired: a missing one would leave the books short. */
function registerRequiredHandlers(dependencies: AccountingHandlerDependencies): void {
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
  registerEventHandler(
    buildPostEnrollmentsHandler({
      enrollments: dependencies.enrollments,
      posting: postingOf(dependencies),
    }),
  );
  registerEventHandler(
    buildPostSalesReturnsHandler({
      salesReturns: dependencies.salesReturns,
      posting: postingOf(dependencies),
    }),
  );
}

function registerOptionalHandlers(dependencies: AccountingHandlerDependencies): void {
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
  if (dependencies.orders !== undefined) {
    registerEventHandler(
      buildPostOrdersHandler({
        orders: dependencies.orders,
        posting: postingOf(dependencies),
      }),
    );
  }
  if (dependencies.stocks !== undefined) {
    registerEventHandler(
      buildPostStockHandler({
        stocks: dependencies.stocks,
        posting: postingOf(dependencies),
      }),
    );
  }
}
