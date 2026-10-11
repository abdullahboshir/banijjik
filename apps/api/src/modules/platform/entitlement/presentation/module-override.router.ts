import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import {
  platformModuleOverrideCreateRequestSchema,
  platformModuleOverrideParamsSchema,
  platformOrganizationParamsSchema,
} from "@banijjik/validation";
import { Router } from "express";
import type { PlatformPermissionMiddlewareFactory } from "../../../../kernel/auth/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { ModuleOverrideController } from "./module-override.controller.js";

/** `/platform/organizations/{organizationId}/module-overrides` (14-API.md section 7). */
export function buildModuleOverrideRouter(
  controller: ModuleOverrideController,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  const router = Router({ mergeParams: true });
  const read = permission(PLATFORM_PERMISSION_KEY.ENTITLEMENT_READ);
  const write = permission(PLATFORM_PERMISSION_KEY.ENTITLEMENT_WRITE);
  router.get("/", read, validate({ params: platformOrganizationParamsSchema }), controller.list);
  router.post(
    "/",
    write,
    validate({
      params: platformOrganizationParamsSchema,
      body: platformModuleOverrideCreateRequestSchema,
    }),
    controller.create,
  );
  router.delete(
    "/:moduleOverrideId",
    write,
    validate({ params: platformModuleOverrideParamsSchema }),
    controller.remove,
  );
  return router;
}
