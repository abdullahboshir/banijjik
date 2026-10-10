import { Router } from "express";
import type { MeConfigController } from "./me-config.controller.js";

/**
 * `GET /me/config` (14-API.md section 4), mounted behind the tenant pipeline by routes/v1.ts. Any
 * active member may read it, so there is no permission guard; the entitlement gate lets this one
 * path through without an owner module (ADR-091).
 */
export function buildMeConfigRouter(controller: MeConfigController): Router {
  const router = Router({ mergeParams: true });
  router.get("/me/config", controller.get);
  return router;
}
