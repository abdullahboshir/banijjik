import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildBookkeepingRouter } from "../modules/commerce/bookkeeping/index.js";

export interface BookkeepingTenantRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
}

export function buildBookkeepingTenantRouter(input: BookkeepingTenantRouterInput): Router {
  return buildBookkeepingRouter({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
  });
}
