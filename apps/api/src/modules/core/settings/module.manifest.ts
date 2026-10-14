import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SETTINGS_EVENT_TYPE,
  permissionDefinition,
} from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * Settings is SYSTEM and always on. Later modules only declare keys; this module owns resolution
 * and the two endpoints (ADR-103). The two common keys live on the organization manifest.
 */
export const settingsManifest = defineModule({
  key: MODULE_KEY.SETTINGS,
  path: "core/settings",
  moduleClass: MODULE_CLASS.SYSTEM,
  dependsOn: [MODULE_KEY.ORGANIZATION],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.SETTINGS_SETTING_READ),
    permissionDefinition(PERMISSION_KEY.SETTINGS_SETTING_UPDATE),
  ],
  routes: { admin: ["/orgs/:organizationId/settings"] },
  menu: [],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [SETTINGS_EVENT_TYPE.SETTING_CHANGED], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});
