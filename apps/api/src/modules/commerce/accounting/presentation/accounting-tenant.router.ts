import { PERMISSION_KEY } from "@banijjik/contracts";
import { journalListQuerySchema, trialBalanceQuerySchema } from "@banijjik/validation/accounting";
import { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { AccountingController } from "./accounting.controller.js";

export interface AccountingRouterDependencies {
  readonly controller: AccountingController;
  readonly permission: PermissionMiddlewareFactory;
}

export function buildAccountingTenantRouter(input: AccountingRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  const { controller, permission } = input;
  router.get(
    "/accounting/accounts",
    permission(PERMISSION_KEY.ACCOUNTING_LEDGER_READ),
    controller.listAccounts,
  );
  router.get(
    "/accounting/journal",
    permission(PERMISSION_KEY.ACCOUNTING_LEDGER_READ),
    validate({ query: journalListQuerySchema }),
    controller.listJournal,
  );
  router.get(
    "/accounting/trial-balance",
    permission(PERMISSION_KEY.ACCOUNTING_LEDGER_READ),
    validate({ query: trialBalanceQuerySchema }),
    controller.trialBalance,
  );
  return router;
}
