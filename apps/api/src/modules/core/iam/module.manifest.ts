import {
  IAM_EVENT_TYPE,
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  permissionDefinition,
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
  menu: [],
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
