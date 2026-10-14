import { MODULE_CLASS, MODULE_KEY } from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * The package manifest. A PLATFORM module: packages are edited in the platform panel (card 1.8),
 * so it declares platform routes only. It never appears in the configuration of an organization.
 */
export const packageManifest = defineModule({
  key: MODULE_KEY.PACKAGE,
  path: "platform/package",
  moduleClass: MODULE_CLASS.PLATFORM,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [],
  routes: { platform: ["/platform/packages"] },
  menu: [],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});
