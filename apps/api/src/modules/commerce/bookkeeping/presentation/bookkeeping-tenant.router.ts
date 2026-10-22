import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  accountListQuerySchema,
  journalListQuerySchema,
  accountCreateRequestSchema,
  accountUpdateRequestSchema,
  balanceSheetQuerySchema,
  manualJournalEntryRequestSchema,
  profitAndLossQuerySchema,
  reverseEntryRequestSchema,
} from "@banijjik/validation/accounting";
import { z } from "zod";
import { Router, type RequestHandler } from "express";
import {
  requireAllLocations,
  type PermissionMiddlewareFactory,
} from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import { uuidV7Schema } from "@banijjik/validation";
import type { BookkeepingController } from "./bookkeeping.controller.js";

export interface BookkeepingRouterDependencies {
  readonly controller: BookkeepingController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

export function buildBookkeepingTenantRouter(input: BookkeepingRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  const { controller, permission } = input;
  router.get(
    "/bookkeeping/accounts",
    permission(PERMISSION_KEY.BOOKKEEPING_ACCOUNT_READ),
    requireAllLocations(),
    validate({ query: accountListQuerySchema }),
    controller.listAccounts,
  );
  router.get(
    "/bookkeeping/journal",
    permission(PERMISSION_KEY.BOOKKEEPING_JOURNAL_READ),
    requireAllLocations(),
    validate({ query: journalListQuerySchema }),
    controller.listJournal,
  );
  router.get(
    "/bookkeeping/trial-balance",
    permission(PERMISSION_KEY.BOOKKEEPING_STATEMENT_READ),
    requireAllLocations(),
    validate({ query: balanceSheetQuerySchema }),
    controller.trialBalance,
  );

  mountBookkeepingWrites(router, input);
  router.get(
    "/bookkeeping/statements/profit-and-loss",
    permission(PERMISSION_KEY.BOOKKEEPING_STATEMENT_READ),
    requireAllLocations(),
    validate({ query: profitAndLossQuerySchema }),
    controller.profitAndLoss,
  );

  router.get(
    "/bookkeeping/statements/balance-sheet",
    permission(PERMISSION_KEY.BOOKKEEPING_STATEMENT_READ),
    requireAllLocations(),
    validate({ query: balanceSheetQuerySchema }),
    controller.balanceSheet,
  );

  return router;
}

function mountBookkeepingWrites(router: Router, input: BookkeepingRouterDependencies): void {
  const { controller, permission } = input;
  router.post(
    "/bookkeeping/accounts",
    permission(PERMISSION_KEY.BOOKKEEPING_ACCOUNT_CREATE),
    requireAllLocations(),
    validate({ body: accountCreateRequestSchema }),
    controller.createAccount,
  );

  router.patch(
    "/bookkeeping/accounts/:accountId",
    permission(PERMISSION_KEY.BOOKKEEPING_ACCOUNT_UPDATE),
    requireAllLocations(),
    validate({ params: z.object({ accountId: uuidV7Schema }), body: accountUpdateRequestSchema }),
    controller.updateAccount,
  );

  router.post(
    "/bookkeeping/journal/manual",
    permission(PERMISSION_KEY.BOOKKEEPING_JOURNAL_CREATE_MANUAL),
    validate({ body: manualJournalEntryRequestSchema }),
    input.idempotency,
    controller.postManualEntry,
  );

  router.post(
    "/bookkeeping/journal/:journalEntryId/reverse",
    permission(PERMISSION_KEY.BOOKKEEPING_JOURNAL_CREATE_MANUAL),
    validate({
      params: z.object({ journalEntryId: uuidV7Schema }),
      body: reverseEntryRequestSchema,
    }),
    input.idempotency,
    controller.reverseEntry,
  );
}
