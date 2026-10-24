import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  commissionPayoutCreateRequestSchema,
  commissionPayoutIdParamsSchema,
  commissionPayoutListQuerySchema,
  commissionPayoutPreviewQuerySchema,
  commissionEntryListQuerySchema,
  commissionMyEntriesQuerySchema,
  commissionRuleArchiveRequestSchema,
  commissionRuleCreateRequestSchema,
  commissionRuleIdParamsSchema,
  commissionRuleListQuerySchema,
  commissionRuleUpdateRequestSchema,
  commissionSummaryQuerySchema,
} from "@banijjik/validation/commission";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { CommissionController } from "./commission.controller.js";

export interface CommissionRouterDependencies {
  readonly controller: CommissionController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

/** Rule writes create no money, so they need no idempotency key (plan 3.11 decision 2); a payout does. */
export function buildCommissionTenantRouter(input: CommissionRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  const { controller, permission } = input;

  router.get(
    "/commission/rules",
    permission(PERMISSION_KEY.COMMISSION_RULE_READ),
    validate({ query: commissionRuleListQuerySchema }),
    controller.listRules,
  );
  router.post(
    "/commission/rules",
    permission(PERMISSION_KEY.COMMISSION_RULE_UPDATE),
    validate({ body: commissionRuleCreateRequestSchema }),
    controller.createRule,
  );
  router.patch(
    "/commission/rules/:commissionRuleId",
    permission(PERMISSION_KEY.COMMISSION_RULE_UPDATE),
    validate({ params: commissionRuleIdParamsSchema, body: commissionRuleUpdateRequestSchema }),
    controller.updateRule,
  );
  router.post(
    "/commission/rules/:commissionRuleId/archive",
    permission(PERMISSION_KEY.COMMISSION_RULE_UPDATE),
    validate({ params: commissionRuleIdParamsSchema, body: commissionRuleArchiveRequestSchema }),
    controller.archiveRule,
  );
  router.get(
    "/commission/entries",
    permission(PERMISSION_KEY.COMMISSION_ENTRY_READ),
    validate({ query: commissionEntryListQuerySchema }),
    controller.listEntries,
  );
  router.get(
    "/commission/my-entries",
    permission(PERMISSION_KEY.COMMISSION_ENTRY_READ_OWN),
    validate({ query: commissionMyEntriesQuerySchema }),
    controller.listMyEntries,
  );
  router.get(
    "/commission/summary",
    permission(PERMISSION_KEY.COMMISSION_ENTRY_READ),
    validate({ query: commissionSummaryQuerySchema }),
    controller.summary,
  );
  mountPayoutRoutes(router, input);
  return router;
}

// The preview route comes before the `:commissionPayoutId` route so "preview" is not read as an ID.
function mountPayoutRoutes(router: Router, input: CommissionRouterDependencies): void {
  const { controller, permission, idempotency } = input;
  router.get(
    "/commission/payouts/preview",
    permission(PERMISSION_KEY.COMMISSION_PAYOUT_CREATE),
    validate({ query: commissionPayoutPreviewQuerySchema }),
    controller.previewPayout,
  );
  router.post(
    "/commission/payouts",
    permission(PERMISSION_KEY.COMMISSION_PAYOUT_CREATE),
    validate({ body: commissionPayoutCreateRequestSchema }),
    idempotency,
    controller.createPayout,
  );
  router.get(
    "/commission/payouts",
    permission(PERMISSION_KEY.COMMISSION_PAYOUT_READ),
    validate({ query: commissionPayoutListQuerySchema }),
    controller.listPayouts,
  );
  router.get(
    "/commission/payouts/:commissionPayoutId",
    permission(PERMISSION_KEY.COMMISSION_PAYOUT_READ),
    validate({ params: commissionPayoutIdParamsSchema }),
    controller.getPayout,
  );
}
