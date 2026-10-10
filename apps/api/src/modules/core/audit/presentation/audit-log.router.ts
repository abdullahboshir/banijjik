import { PERMISSION_KEY } from "@banijjik/contracts";
import { auditLogListQuerySchema } from "@banijjik/validation";
import { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { AuditLogController } from "./audit-log.controller.js";

/**
 * `GET /audit-logs` (14-API.md section 5.1), mounted behind the tenant pipeline by routes/v1.ts.
 * Audit is organization-level: no location narrowing is applied to the read.
 */
export function buildAuditLogRouter(
  controller: AuditLogController,
  permission: PermissionMiddlewareFactory,
): Router {
  const router = Router({ mergeParams: true });
  router.get(
    "/audit-logs",
    permission(PERMISSION_KEY.AUDIT_LOG_READ),
    validate({ query: auditLogListQuerySchema }),
    controller.list,
  );
  return router;
}
