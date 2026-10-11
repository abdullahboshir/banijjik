import { MODULE_CLASS, MODULE_KEY } from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * The saas-billing manifest. A PLATFORM module. Card 1.6a adds the subscription and the trial;
 * invoices and payment collection arrive with card 6.2, so only the platform subscription route (card 1.8a) and no menu entry yet.
 */
export const saasBillingManifest = defineModule({
  key: MODULE_KEY.SAAS_BILLING,
  path: "platform/saas-billing",
  moduleClass: MODULE_CLASS.PLATFORM,
  dependsOn: [MODULE_KEY.PACKAGE],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [],
  routes: { platform: ["/platform/organizations/:organizationId/subscription"] },
  menu: [],
  settingKeys: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});
