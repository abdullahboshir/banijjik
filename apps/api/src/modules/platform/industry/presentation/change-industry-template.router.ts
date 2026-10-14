import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import {
  changeIndustryTemplateRequestSchema,
  platformOrganizationParamsSchema,
} from "@banijjik/validation";
import { Router } from "express";
import type { PlatformPermissionMiddlewareFactory } from "../../../../kernel/auth/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { ChangeIndustryTemplateController } from "./change-industry-template.controller.js";

/** `POST /platform/organizations/{organizationId}/change-industry-template`. */
export function buildChangeIndustryTemplateRoutes(
  controller: ChangeIndustryTemplateController,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  const router = Router({ mergeParams: true });
  router.post(
    "/",
    permission(PLATFORM_PERMISSION_KEY.INDUSTRY_WRITE),
    validate({
      params: platformOrganizationParamsSchema,
      body: changeIndustryTemplateRequestSchema,
    }),
    controller.change,
  );
  return router;
}
