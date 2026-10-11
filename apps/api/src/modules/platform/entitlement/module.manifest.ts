import { MODULE_CLASS, MODULE_KEY } from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * The entitlement manifest. A PLATFORM module that owns ModuleOverride and the resolver. Its one
 * tenant route, `GET /orgs/{organizationId}/me/config`, is the single path the entitlement gate
 * allows without an owner module, so the manifest declares only the platform route of the overrides.
 */
export const entitlementManifest = defineModule({
  key: MODULE_KEY.ENTITLEMENT,
  path: "platform/entitlement",
  moduleClass: MODULE_CLASS.PLATFORM,
  dependsOn: [MODULE_KEY.PACKAGE],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [],
  routes: { platform: ["/platform/organizations/:organizationId/module-overrides"] },
  menu: [],
  settingKeys: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});
