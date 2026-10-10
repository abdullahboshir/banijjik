import {
  LIMIT_KEY,
  MODULE_CLASS,
  MODULE_KEY,
  ORGANIZATION_EVENT_TYPE,
  PERMISSION_KEY,
  permissionDefinition,
} from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * The organization manifest in the shape of 10-MODULE-CATALOG section 2.
 */
export const organizationManifest = defineModule({
  key: MODULE_KEY.ORGANIZATION,
  path: "core/organization",
  moduleClass: MODULE_CLASS.SYSTEM,
  dependsOn: [MODULE_KEY.IAM],
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
  routes: {
    admin: [
      "/me/orgs",
      "/orgs/:organizationId/profile",
      "/orgs/:organizationId/locations",
      "/orgs/:organizationId/members",
      "/orgs/:organizationId/invitations",
      "/invitations",
    ],
  },
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
      ORGANIZATION_EVENT_TYPE.ORGANIZATION_RENAMED,
      ORGANIZATION_EVENT_TYPE.LOCATION_UPDATED,
      ORGANIZATION_EVENT_TYPE.LOCATION_ARCHIVED,
      ORGANIZATION_EVENT_TYPE.MEMBER_INVITED,
      ORGANIZATION_EVENT_TYPE.MEMBER_ASSIGNMENTS_CHANGED,
      ORGANIZATION_EVENT_TYPE.MEMBER_SUSPENDED,
      ORGANIZATION_EVENT_TYPE.MEMBER_REACTIVATED,
      ORGANIZATION_EVENT_TYPE.MEMBER_REMOVED,
      ORGANIZATION_EVENT_TYPE.INVITATION_REVOKED,
    ],
    consumes: [],
  },
  limitKeys: [LIMIT_KEY.LOCATIONS, LIMIT_KEY.MEMBERS],
  sequenceKeys: ["MEMBER"],
});
