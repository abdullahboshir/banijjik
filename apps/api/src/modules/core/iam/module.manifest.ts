import {
  IAM_EVENT_TYPE,
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  permissionDefinition,
  SETTINGS_TOPIC,
  SURFACE,
} from "@banijjik/contracts";
import { IAM_OWNER_SELF_APPROVAL_SETTING_KEY } from "@banijjik/contracts/iam";
import { defineModule } from "../../../kernel/modules/index.js";

/** The iam manifest in the shape of 10-MODULE-CATALOG section 2. */
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
    permissionDefinition(PERMISSION_KEY.IAM_APPROVAL_GRANT),
  ],
  routes: {
    admin: [
      "/auth",
      "/me",
      "/orgs/:organizationId/roles",
      "/orgs/:organizationId/me/approval-pin",
      "/orgs/:organizationId/approvals",
      "/orgs/:organizationId/approvers",
    ],
  },
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
  settings: [
    {
      settingKey: IAM_OWNER_SELF_APPROVAL_SETTING_KEY,
      value: { kind: "BOOLEAN" },
      systemDefault: true,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
  ],
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
