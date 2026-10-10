import { ORGANIZATION_EVENT_TYPE } from "@banijjik/contracts";

/**
 * The organization manifest in the shape of 10-MODULE-CATALOG section 2. `defineModule` and its
 * validation arrive with card 1.6; until then this is a plain object. Permissions come with card 1.4.
 */
export const organizationManifest = {
  key: "organization",
  path: "core/organization",
  moduleClass: "SYSTEM",
  dependsOn: ["iam"],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [],
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
