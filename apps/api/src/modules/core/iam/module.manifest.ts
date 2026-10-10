import { IAM_EVENT_TYPE, PERMISSION_KEY, permissionDefinition } from "@banijjik/contracts";

/**
 * The iam manifest in the shape of 10-MODULE-CATALOG section 2. `defineModule` and its validation
 * arrive with card 1.6; until then this is a plain object. Settings are still empty.
 */
export const iamManifest = {
  key: "iam",
  path: "core/iam",
  moduleClass: "SYSTEM",
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
  routes: { admin: ["/auth", "/me", "/roles"] },
  menu: [],
  settingKeys: [],
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
} as const;
