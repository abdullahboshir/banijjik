import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { Clock } from "../kernel/time/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { buildReportRouter } from "../modules/commerce/report/index.js";
import { buildReportOrganizationSettings } from "./report-sources.js";

export function buildReportTenantRouter(input: {
  readonly clock: Clock;
  readonly permission: PermissionMiddlewareFactory;
  readonly orgConfig: OrgConfigService;
}): Router {
  return buildReportRouter({
    permission: input.permission,
    orgConfig: input.orgConfig,
    settings: buildReportOrganizationSettings(),
    clock: input.clock,
  });
}
