import { PERMISSION_KEY } from "@banijjik/contracts";
import { reportDailyQuerySchema, reportHomeQuerySchema } from "@banijjik/validation/report";
import { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { ReportController } from "./report.controller.js";

export interface ReportRouterDependencies {
  readonly controller: ReportController;
  readonly permission: PermissionMiddlewareFactory;
}

export function buildReportTenantRouter(input: ReportRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  const { controller, permission } = input;
  router.get(
    "/reports/home",
    permission(PERMISSION_KEY.REPORT_HOME_READ),
    validate({ query: reportHomeQuerySchema }),
    controller.home,
  );
  router.get(
    "/reports/daily",
    permission(PERMISSION_KEY.REPORT_DAILY_READ),
    validate({ query: reportDailyQuerySchema }),
    controller.daily,
  );
  return router;
}
