import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import {
  ListBookkeepingAccountsUseCase,
  ListJournalUseCase,
  GetTrialBalanceUseCase,
  MongoAccountRepository,
  MongoJournalRepository,
  type OrganizationCurrencyPort,
} from "../accounting/index.js";
import { buildApprovalVerifier } from "../../core/iam/index.js";
import { CreateAccountUseCase } from "./application/use-cases/create-account.use-case.js";
import { UpdateAccountUseCase } from "./application/use-cases/update-account.use-case.js";
import { PostManualEntryUseCase } from "./application/use-cases/post-manual-entry.use-case.js";
import { ReverseEntryUseCase } from "./application/use-cases/reverse-entry.use-case.js";
import { ProfitAndLossUseCase } from "./application/use-cases/profit-and-loss.use-case.js";
import { BalanceSheetUseCase } from "./application/use-cases/balance-sheet.use-case.js";
import { BookkeepingController } from "./presentation/bookkeeping.controller.js";
import { buildBookkeepingTenantRouter } from "./presentation/bookkeeping-tenant.router.js";

export { bookkeepingManifest } from "./module.manifest.js";

export interface BookkeepingTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly currencies: OrganizationCurrencyPort;
  readonly policy: {
    ownerMaySkip(organizationId: import("@banijjik/ids").OrganizationId): Promise<boolean>;
  };
  readonly locations: { isActiveLocation(locationId: string): Promise<boolean> };
}

export function buildBookkeepingRouter(dependencies: BookkeepingTenantDependencies): Router {
  const accounts = new MongoAccountRepository();
  const journals = new MongoJournalRepository();
  const approvals = buildApprovalVerifier({ audit: dependencies.audit, clock: dependencies.clock });
  const controller = new BookkeepingController({
    listAccounts: new ListBookkeepingAccountsUseCase({
      accounts,
      journals,
      clock: dependencies.clock,
      currencies: dependencies.currencies,
    }),
    listJournal: new ListJournalUseCase(journals),
    trialBalance: new GetTrialBalanceUseCase(accounts, journals, dependencies.currencies),
    createAccount: new CreateAccountUseCase(accounts, dependencies.clock, dependencies.audit),
    updateAccount: new UpdateAccountUseCase(accounts, dependencies.clock, dependencies.audit),
    postManualEntry: new PostManualEntryUseCase({
      accounts,
      journals,
      events: kernelEventPublisher,
      audit: dependencies.audit,
      clock: dependencies.clock,
      approvals,
      currencies: dependencies.currencies,
      policy: dependencies.policy,
      locations: dependencies.locations,
      unitOfWork: new MongoUnitOfWork(),
    }),
    reverseEntry: new ReverseEntryUseCase({
      accounts,
      journals,
      events: kernelEventPublisher,
      audit: dependencies.audit,
      clock: dependencies.clock,
      approvals,
      currencies: dependencies.currencies,
      policy: dependencies.policy,
      locations: dependencies.locations,
      unitOfWork: new MongoUnitOfWork(),
    }),
    profitAndLoss: new ProfitAndLossUseCase(accounts, journals, dependencies.currencies),
    balanceSheet: new BalanceSheetUseCase(accounts, journals, dependencies.currencies),
  });
  return buildBookkeepingTenantRouter({
    controller,
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
  });
}
