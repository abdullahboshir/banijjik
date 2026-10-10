import { defineEnum } from "../define-enum.js";

/** How a ModuleOverride changes the purchased modules of one organization (10-MODULE-CATALOG section 3, step 1). */
export const MODULE_OVERRIDE_EFFECT = defineEnum([
  "PLATFORM_GRANT",
  "PLATFORM_REVOKE",
  "TENANT_DISABLE",
]);

export type ModuleOverrideEffect =
  (typeof MODULE_OVERRIDE_EFFECT)[keyof typeof MODULE_OVERRIDE_EFFECT];
