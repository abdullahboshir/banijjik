import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SETTINGS_EVENT_TYPE,
  SETTINGS_TOPIC,
  SURFACE,
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
    permissionDefinition(PERMISSION_KEY.SETTINGS_TERM_UPDATE),
    permissionDefinition(PERMISSION_KEY.SETTINGS_MODULE_UPDATE),
  ],
  routes: {
    admin: [
      "/orgs/:organizationId/settings",
      "/orgs/:organizationId/terms",
      "/orgs/:organizationId/modules",
    ],
  },
  // Order 50 to 70 follows the organization entries (10 to 30) in the settings group (10 section 6).
  menu: [
    {
      menuKey: "settings.general",
      surface: SURFACE.ADMIN,
      groupKey: "settings",
      labelTermKey: "menu.settings.general",
      path: "settings/general",
      iconKey: "settings",
      permissionKey: PERMISSION_KEY.SETTINGS_SETTING_READ,
      order: 50,
      settingsTopicKey: SETTINGS_TOPIC.BUSINESS,
    },
    {
      menuKey: "settings.terms",
      surface: SURFACE.ADMIN,
      groupKey: "settings",
      labelTermKey: "menu.settings.terms",
      path: "settings/terms",
      iconKey: "tag",
      permissionKey: PERMISSION_KEY.SETTINGS_SETTING_READ,
      order: 60,
      settingsTopicKey: SETTINGS_TOPIC.BUSINESS,
    },
    {
      menuKey: "settings.modules",
      surface: SURFACE.ADMIN,
      groupKey: "settings",
      labelTermKey: "menu.settings.modules",
      path: "settings/modules",
      iconKey: "package",
      permissionKey: PERMISSION_KEY.SETTINGS_SETTING_READ,
      order: 70,
      settingsTopicKey: SETTINGS_TOPIC.ADVANCED,
    },
  ],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [
      SETTINGS_EVENT_TYPE.SETTING_CHANGED,
      SETTINGS_EVENT_TYPE.TERM_CHANGED,
      SETTINGS_EVENT_TYPE.MODULE_TOGGLED,
    ],
    consumes: [],
  },
  limitKeys: [],
  sequenceKeys: [],
});
