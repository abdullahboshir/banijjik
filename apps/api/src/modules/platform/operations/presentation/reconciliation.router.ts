import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import {
  platformReconciliationQuerySchema,
  platformReconciliationRunRequestSchema,
} from "@banijjik/validation";
import { Router } from "express";
import type { PlatformPermissionMiddlewareFactory } from "../../../../kernel/auth/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { ReconciliationController } from "./reconciliation.controller.js";

export function buildReconciliationRouter(
  controller: ReconciliationController,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  const read = permission(PLATFORM_PERMISSION_KEY.EVENTS_READ);
  const replay = permission(PLATFORM_PERMISSION_KEY.EVENTS_REPLAY);
  const router = Router();

  router.get(
    "/",
    read,
    validate({ query: platformReconciliationQuerySchema }),
    controller.getReconciliation,
  );

  router.post(
    "/run",
    replay,
    validate({ body: platformReconciliationRunRequestSchema }),
    controller.runReconciliation,
  );

  return router;
}
