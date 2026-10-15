import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  moduleKeyParamsSchema,
  moduleSwitchRequestSchema,
  paginationQuerySchema,
  settingsQuerySchema,
  updateSettingsRequestSchema,
  updateTermsRequestSchema,
} from "@banijjik/validation";
import { Router } from "express";
import {
  requireAllLocations,
  type PermissionMiddlewareFactory,
} from "../../../../kernel/access/index.js";
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
  router.get("/terms", permission(PERMISSION_KEY.SETTINGS_SETTING_READ), controller.getTerms);
  router.patch(
    "/terms",
    permission(PERMISSION_KEY.SETTINGS_TERM_UPDATE),
    requireAllLocations(),
    validate({ body: updateTermsRequestSchema }),
    controller.updateTerms,
  );
  router.get(
    "/modules",
    permission(PERMISSION_KEY.SETTINGS_SETTING_READ),
    validate({ query: paginationQuerySchema }),
    controller.listModules,
  );
  router.post(
    "/modules/:moduleKey/disable",
    permission(PERMISSION_KEY.SETTINGS_MODULE_UPDATE),
    requireAllLocations(),
    validate({ params: moduleKeyParamsSchema, body: moduleSwitchRequestSchema }),
    controller.disableModule,
  );
  router.post(
    "/modules/:moduleKey/enable",
    permission(PERMISSION_KEY.SETTINGS_MODULE_UPDATE),
    requireAllLocations(),
    validate({ params: moduleKeyParamsSchema, body: moduleSwitchRequestSchema }),
    controller.enableModule,
  );
  return router;
}
