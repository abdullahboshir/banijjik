import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import {
  platformOrganizationListQuerySchema,
  platformOrganizationParamsSchema,
  platformReasonRequestSchema,
} from "@banijjik/validation";
import { Router } from "express";
import type { PlatformPermissionMiddlewareFactory } from "../../../../kernel/auth/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { TenantController } from "./tenant.controller.js";

/** `/platform/organizations` (14-API.md section 7), mounted behind `authenticatePlatform` by routes/v1.ts. */
export function buildTenantRouter(
  controller: TenantController,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  const router = Router();
  const read = permission(PLATFORM_PERMISSION_KEY.TENANT_READ);
  const suspend = permission(PLATFORM_PERMISSION_KEY.TENANT_SUSPEND);
  const params = platformOrganizationParamsSchema;
  router.get("/", read, validate({ query: platformOrganizationListQuerySchema }), controller.list);
  router.get("/:organizationId", read, validate({ params }), controller.get);
  router.post(
    "/:organizationId/suspend",
    suspend,
    validate({ params, body: platformReasonRequestSchema }),
    controller.suspend,
  );
  router.post(
    "/:organizationId/reactivate",
    suspend,
    validate({ params, body: platformReasonRequestSchema }),
    controller.reactivate,
  );
  return router;
}
