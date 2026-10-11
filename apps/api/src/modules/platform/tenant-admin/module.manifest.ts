import { MODULE_CLASS, MODULE_KEY } from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * The tenant-admin manifest: the platform panel's view of organizations (list, detail, suspend,
 * reactivate). A PLATFORM module, so it declares platform routes only and never appears in the
 * configuration of an organization. The status change itself is owned by core/organization.
 */
export const tenantAdminManifest = defineModule({
  key: MODULE_KEY.TENANT_ADMIN,
  path: "platform/tenant-admin",
  moduleClass: MODULE_CLASS.PLATFORM,
  dependsOn: [MODULE_KEY.ORGANIZATION, MODULE_KEY.ENTITLEMENT, MODULE_KEY.SAAS_BILLING],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [],
  routes: { platform: ["/platform/organizations"] },
  menu: [],
  settingKeys: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});
