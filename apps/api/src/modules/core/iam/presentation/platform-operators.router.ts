import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import {
  platformOperatorCreateRequestSchema,
  platformOperatorListQuerySchema,
  platformOperatorParamsSchema,
  platformOperatorStatusRequestSchema,
  platformOperatorUpdateRequestSchema,
} from "@banijjik/validation";
import { Router } from "express";
import type { PlatformPermissionMiddlewareFactory } from "../../../../kernel/auth/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { PlatformOperatorsController } from "./platform-operators.controller.js";

/** `/platform/operators` (14-API.md section 7), mounted behind `authenticatePlatform`. */
export function buildPlatformOperatorsRouter(
  controller: PlatformOperatorsController,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  const router = Router();
  const read = permission(PLATFORM_PERMISSION_KEY.OPERATOR_READ);
  const write = permission(PLATFORM_PERMISSION_KEY.OPERATOR_WRITE);
  const params = validate({ params: platformOperatorParamsSchema });
  const statusBody = validate({
    params: platformOperatorParamsSchema,
    body: platformOperatorStatusRequestSchema,
  });
  router.get("/", read, validate({ query: platformOperatorListQuerySchema }), controller.list);
  router.post(
    "/",
    write,
    validate({ body: platformOperatorCreateRequestSchema }),
    controller.create,
  );
  router.get("/:platformOperatorId", read, params, controller.get);
  router.patch(
    "/:platformOperatorId",
    write,
    validate({ params: platformOperatorParamsSchema, body: platformOperatorUpdateRequestSchema }),
    controller.update,
  );
  router.post("/:platformOperatorId/disable", write, statusBody, controller.disable);
  router.post("/:platformOperatorId/enable", write, statusBody, controller.enable);
  return router;
}
