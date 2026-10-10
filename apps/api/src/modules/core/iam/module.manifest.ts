import { IAM_EVENT_TYPE } from "@banijjik/contracts";

/**
 * The iam manifest in the shape of 10-MODULE-CATALOG section 2. `defineModule` and its validation
 * arrive with card 1.6; until then this is a plain object. Permissions and settings are empty:
 * roles come with card 1.4.
 */
export const iamManifest = {
  key: "iam",
  path: "core/iam",
  moduleClass: "SYSTEM",
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [],
  routes: { admin: ["/auth", "/me"] },
  menu: [],
  settingKeys: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [IAM_EVENT_TYPE.USER_REGISTERED], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
} as const;
