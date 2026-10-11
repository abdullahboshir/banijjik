import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import {
  platformChangePackageRequestSchema,
  platformExtendTrialRequestSchema,
  platformOrganizationParamsSchema,
} from "@banijjik/validation";
import { Router } from "express";
import type { PlatformPermissionMiddlewareFactory } from "../../../../kernel/auth/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { SubscriptionController } from "./subscription.controller.js";

/** `/platform/organizations/{organizationId}/subscription` (14-API.md section 7). */
export function buildSubscriptionRouter(
  controller: SubscriptionController,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  const router = Router({ mergeParams: true });
  const params = platformOrganizationParamsSchema;
  const write = permission(PLATFORM_PERMISSION_KEY.SUBSCRIPTION_WRITE);
  router.get(
    "/",
    permission(PLATFORM_PERMISSION_KEY.SUBSCRIPTION_READ),
    validate({ params }),
    controller.get,
  );
  router.post(
    "/extend-trial",
    write,
    validate({ params, body: platformExtendTrialRequestSchema }),
    controller.extendTrial,
  );
  router.post(
    "/change-package",
    write,
    validate({ params, body: platformChangePackageRequestSchema }),
    controller.changePackage,
  );
  return router;
}
