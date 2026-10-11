import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import {
  platformPackageCreateRequestSchema,
  platformPackageListQuerySchema,
  platformPackageParamsSchema,
  platformPackageUpdateRequestSchema,
  versionedTransitionRequestSchema,
} from "@banijjik/validation";
import { Router } from "express";
import type { PlatformPermissionMiddlewareFactory } from "../../../../kernel/auth/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { PackageController } from "./package.controller.js";

/** `/platform/packages` (14-API.md section 7), mounted behind `authenticatePlatform` by routes/v1.ts. */
export function buildPackageRouter(
  controller: PackageController,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  const router = Router();
  const read = permission(PLATFORM_PERMISSION_KEY.PACKAGE_READ);
  const write = permission(PLATFORM_PERMISSION_KEY.PACKAGE_WRITE);
  const params = validate({ params: platformPackageParamsSchema });
  router.get("/", read, validate({ query: platformPackageListQuerySchema }), controller.list);
  router.post(
    "/",
    write,
    validate({ body: platformPackageCreateRequestSchema }),
    controller.create,
  );
  router.get("/:packageId", read, params, controller.get);
  router.patch(
    "/:packageId",
    write,
    validate({ params: platformPackageParamsSchema, body: platformPackageUpdateRequestSchema }),
    controller.update,
  );
  router.post(
    "/:packageId/archive",
    write,
    validate({ params: platformPackageParamsSchema, body: versionedTransitionRequestSchema }),
    controller.archive,
  );
  return router;
}
