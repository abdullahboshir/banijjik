import {
  IAM_EVENT_TYPE,
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  permissionDefinition,
  SETTINGS_TOPIC,
  SURFACE,
} from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";

/** The iam manifest in the shape of 10-MODULE-CATALOG section 2. Settings are still empty. */
export const iamManifest = defineModule({
  key: MODULE_KEY.IAM,
  path: "core/iam",
  moduleClass: MODULE_CLASS.SYSTEM,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.IAM_ROLE_READ),
    permissionDefinition(PERMISSION_KEY.IAM_ROLE_CREATE),
    permissionDefinition(PERMISSION_KEY.IAM_ROLE_UPDATE),
    permissionDefinition(PERMISSION_KEY.IAM_ROLE_ARCHIVE),
  ],
  routes: { admin: ["/auth", "/me", "/orgs/:organizationId/roles"] },
  // Order 40 sits between the staff (30) and settings (50) entries of the settings group.
  menu: [
    {
      menuKey: "iam.roles",
      surface: SURFACE.ADMIN,
      groupKey: "settings",
      labelTermKey: "menu.iam.roles",
      path: "settings/roles",
      iconKey: "users",
      permissionKey: PERMISSION_KEY.IAM_ROLE_READ,
      order: 40,
      settingsTopicKey: SETTINGS_TOPIC.TEAM,
    },
  ],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [
      IAM_EVENT_TYPE.USER_REGISTERED,
      IAM_EVENT_TYPE.ROLE_CREATED,
      IAM_EVENT_TYPE.ROLE_PERMISSIONS_CHANGED,
      IAM_EVENT_TYPE.ROLE_ARCHIVED,
    ],
    consumes: [],
  },
  limitKeys: [],
  sequenceKeys: [],
});
