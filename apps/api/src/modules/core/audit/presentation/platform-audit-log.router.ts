import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import { platformAuditLogListQuerySchema } from "@banijjik/validation";
import { Router } from "express";
import type { PlatformPermissionMiddlewareFactory } from "../../../../kernel/auth/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { PlatformAuditLogController } from "./platform-audit-log.controller.js";

/** `GET /audit-logs` of the platform API; the SUPER_ADMIN role alone holds the permission. */
export function buildPlatformAuditLogRouter(
  controller: PlatformAuditLogController,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  const router = Router();
  router.get(
    "/audit-logs",
    permission(PLATFORM_PERMISSION_KEY.AUDIT_READ),
    validate({ query: platformAuditLogListQuerySchema }),
    controller.list,
  );
  return router;
}
