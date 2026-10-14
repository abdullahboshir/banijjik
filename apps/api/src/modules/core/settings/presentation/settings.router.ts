import { PERMISSION_KEY } from "@banijjik/contracts";
import { settingsQuerySchema, updateSettingsRequestSchema } from "@banijjik/validation";
import { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { SettingsController } from "./settings.controller.js";

export function buildSettingsRouter(
  controller: SettingsController,
  permission: PermissionMiddlewareFactory,
): Router {
  const router = Router();
  router.get(
    "/settings",
    permission(PERMISSION_KEY.SETTINGS_SETTING_READ),
    validate({ query: settingsQuerySchema }),
    controller.getSettings,
  );
  // No requireAllLocations: a one-location manager may patch that location. The use case checks.
  router.patch(
    "/settings",
    permission(PERMISSION_KEY.SETTINGS_SETTING_UPDATE),
    validate({ body: updateSettingsRequestSchema }),
    controller.updateSettings,
  );
  return router;
}
