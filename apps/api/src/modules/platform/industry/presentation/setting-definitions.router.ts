import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import { Router } from "express";
import type { PlatformPermissionMiddlewareFactory } from "../../../../kernel/auth/index.js";
import type { SettingDefinitionsController } from "./setting-definitions.controller.js";

/** `/platform/setting-definitions`, mounted behind authenticatePlatform. */
export function buildSettingDefinitionsRouter(
  controller: SettingDefinitionsController,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  const router = Router();
  router.get("/", permission(PLATFORM_PERMISSION_KEY.INDUSTRY_READ), controller.list);
  return router;
}
