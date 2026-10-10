import { ORGANIZATION_EVENT_TYPE, PERMISSION_KEY, permissionDefinition } from "@banijjik/contracts";

/**
 * The organization manifest in the shape of 10-MODULE-CATALOG section 2. `defineModule` and its
 * validation arrive with card 1.6; until then this is a plain object.
 */
export const organizationManifest = {
  key: "organization",
  path: "core/organization",
  moduleClass: "SYSTEM",
  dependsOn: ["iam"],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE),
    permissionDefinition(PERMISSION_KEY.ORGANIZATION_LOCATION_READ),
    permissionDefinition(PERMISSION_KEY.ORGANIZATION_LOCATION_CREATE),
    permissionDefinition(PERMISSION_KEY.ORGANIZATION_LOCATION_UPDATE),
    permissionDefinition(PERMISSION_KEY.ORGANIZATION_LOCATION_ARCHIVE),
    permissionDefinition(PERMISSION_KEY.ORGANIZATION_MEMBER_READ),
    permissionDefinition(PERMISSION_KEY.ORGANIZATION_MEMBER_INVITE),
    permissionDefinition(PERMISSION_KEY.ORGANIZATION_MEMBER_UPDATE),
    permissionDefinition(PERMISSION_KEY.ORGANIZATION_MEMBER_REMOVE),
    permissionDefinition(PERMISSION_KEY.ORGANIZATION_MEMBER_READ_SENSITIVE, { isSensitive: true }),
    permissionDefinition(PERMISSION_KEY.ORGANIZATION_OWNERSHIP_TRANSFER, { isSensitive: true }),
  ],
  routes: { admin: ["/me/orgs"] },
  menu: [],
  settingKeys: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [
      ORGANIZATION_EVENT_TYPE.ORGANIZATION_CREATED,
      ORGANIZATION_EVENT_TYPE.LOCATION_CREATED,
      ORGANIZATION_EVENT_TYPE.MEMBER_JOINED,
    ],
    consumes: [],
  },
  limitKeys: [],
  sequenceKeys: ["MEMBER"],
} as const;
