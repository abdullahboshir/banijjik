import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildOrganizationCurrencyReader } from "../modules/core/organization/index.js";
import { buildAccountingRouter } from "../modules/commerce/accounting/index.js";

export interface AccountingRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
}

/** Accounting read API, mounted on the tenant pipeline (card 3.8c). */
export function buildAccountingTenantRouter(input: AccountingRouterInput): Router {
  return buildAccountingRouter({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    currencies: buildOrganizationCurrencyReader(),
  });
}
