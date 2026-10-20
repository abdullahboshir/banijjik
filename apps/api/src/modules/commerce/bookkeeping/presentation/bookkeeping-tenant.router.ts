import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  accountCreateRequestSchema,
  accountUpdateRequestSchema,
  balanceSheetQuerySchema,
  manualJournalEntryRequestSchema,
  profitAndLossQuerySchema,
  reverseEntryRequestSchema,
} from "@banijjik/validation/accounting";
import { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import { uuidV7Schema } from "../../../../kernel/http/uuid-v7-param.js";
import type { BookkeepingController } from "./bookkeeping.controller.js";

export interface BookkeepingRouterDependencies {
  readonly controller: BookkeepingController;
  readonly permission: PermissionMiddlewareFactory;
}

export function buildBookkeepingTenantRouter(input: BookkeepingRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  const { controller, permission } = input;

  router.post(
    "/bookkeeping/accounts",
    permission(PERMISSION_KEY.BOOKKEEPING_ACCOUNT_CREATE),
    validate({ body: accountCreateRequestSchema }),
    controller.createAccount,
  );

  router.patch(
    "/bookkeeping/accounts/:accountId",
    permission(PERMISSION_KEY.BOOKKEEPING_ACCOUNT_UPDATE),
    validate({ params: { accountId: uuidV7Schema }, body: accountUpdateRequestSchema }),
    controller.updateAccount,
  );

  router.post(
    "/bookkeeping/journal/manual",
    permission(PERMISSION_KEY.BOOKKEEPING_JOURNAL_CREATE_MANUAL),
    validate({ body: manualJournalEntryRequestSchema }),
    controller.postManualEntry,
  );

  router.post(
    "/bookkeeping/journal/:journalEntryId/reverse",
    permission(PERMISSION_KEY.BOOKKEEPING_JOURNAL_CREATE_MANUAL),
    validate({ params: { journalEntryId: uuidV7Schema }, body: reverseEntryRequestSchema }),
    controller.reverseEntry,
  );

  router.get(
    "/bookkeeping/statements/profit-and-loss",
    permission(PERMISSION_KEY.BOOKKEEPING_STATEMENT_READ),
    validate({ query: profitAndLossQuerySchema }),
    controller.profitAndLoss,
  );

  router.get(
    "/bookkeeping/statements/balance-sheet",
    permission(PERMISSION_KEY.BOOKKEEPING_STATEMENT_READ),
    validate({ query: balanceSheetQuerySchema }),
    controller.balanceSheet,
  );

  return router;
}
