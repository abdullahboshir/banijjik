import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import {
  industryTemplateCreateRequestSchema,
  industryTemplateStatusRequestSchema,
  industryTemplateUpdateRequestSchema,
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
  const write = permission(PLATFORM_PERMISSION_KEY.INDUSTRY_WRITE);
  const params = validate({ params: platformIndustryTemplateParamsSchema });
  router.get(
    "/",
    read,
    validate({ query: platformIndustryTemplateListQuerySchema }),
    controller.list,
  );
  router.post(
    "/",
    write,
    validate({ body: industryTemplateCreateRequestSchema }),
    controller.create,
  );
  router.get("/:industryTemplateId", read, params, controller.get);
  router.patch(
    "/:industryTemplateId",
    write,
    validate({
      params: platformIndustryTemplateParamsSchema,
      body: industryTemplateUpdateRequestSchema,
    }),
    controller.update,
  );
  router.post(
    "/:industryTemplateId/publish",
    write,
    validate({
      params: platformIndustryTemplateParamsSchema,
      body: industryTemplateStatusRequestSchema,
    }),
    controller.publish,
  );
  router.post(
    "/:industryTemplateId/retire",
    write,
    validate({
      params: platformIndustryTemplateParamsSchema,
      body: industryTemplateStatusRequestSchema,
    }),
    controller.retire,
  );
  return router;
}
