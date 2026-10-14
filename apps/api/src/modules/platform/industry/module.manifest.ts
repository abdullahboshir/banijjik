import { MODULE_CLASS, MODULE_KEY } from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * The industry manifest. A PLATFORM module: templates are read in the platform panel (card 2.1a)
 * and edited there in card 2.1b. It never appears in the configuration of an organization.
 * The signup list `GET /industry-templates` is a user route, so it is mounted beside `/me` and
 * is not declared here: a PLATFORM manifest may declare platform routes only.
 */
export const industryManifest = defineModule({
  key: MODULE_KEY.INDUSTRY,
  path: "platform/industry",
  moduleClass: MODULE_CLASS.PLATFORM,
  dependsOn: [MODULE_KEY.PACKAGE],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [],
  routes: { platform: ["/platform/industry-templates"] },
  menu: [],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});
