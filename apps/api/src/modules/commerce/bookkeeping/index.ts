import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { MongoAccountRepository, MongoJournalRepository } from "../accounting/index.js";
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
}

export function buildBookkeepingRouter(dependencies: BookkeepingTenantDependencies): Router {
  const accounts = new MongoAccountRepository();
  const journals = new MongoJournalRepository();
  const controller = new BookkeepingController({
    createAccount: new CreateAccountUseCase(accounts, dependencies.clock),
    updateAccount: new UpdateAccountUseCase(accounts, dependencies.clock),
    postManualEntry: new PostManualEntryUseCase({
      accounts,
      journals,
      events: kernelEventPublisher,
      audit: dependencies.audit,
      clock: dependencies.clock,
    }),
    reverseEntry: new ReverseEntryUseCase({
      accounts,
      journals,
      events: kernelEventPublisher,
      audit: dependencies.audit,
      clock: dependencies.clock,
    }),
    profitAndLoss: new ProfitAndLossUseCase(accounts, journals),
    balanceSheet: new BalanceSheetUseCase(accounts, journals),
  });
  return buildBookkeepingTenantRouter({
    controller,
    permission: dependencies.permission,
  });
}
