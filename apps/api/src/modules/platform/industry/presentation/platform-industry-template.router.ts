import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import {
  platformIndustryTemplateListQuerySchema,
  platformIndustryTemplateParamsSchema,
} from "@banijjik/validation";
import { Router } from "express";
import type { PlatformPermissionMiddlewareFactory } from "../../../../kernel/auth/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { PlatformIndustryTemplateController } from "./platform-industry-template.controller.js";

/** `/platform/industry-templates` (14-API.md section 7), mounted behind authenticatePlatform. */
export function buildPlatformIndustryTemplateRouter(
  controller: PlatformIndustryTemplateController,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  const router = Router();
  const read = permission(PLATFORM_PERMISSION_KEY.INDUSTRY_READ);
  router.get(
    "/",
    read,
    validate({ query: platformIndustryTemplateListQuerySchema }),
    controller.list,
  );
  router.get(
    "/:industryTemplateId",
    read,
    validate({ params: platformIndustryTemplateParamsSchema }),
    controller.get,
  );
  return router;
}
