import {
  EVENT_TYPE,
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  permissionDefinition,
} from "@banijjik/contracts";
import { COMMISSION_EVENT_TYPE } from "@banijjik/contracts/commission";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * The commission manifest (card 3.11, ADR-135). OPTIONAL: it is sold as the `ADDON_COMMISSION`
 * package. It has no menu entries yet; the screens arrive with Part B.
 */
export const commissionManifest = defineModule({
  key: MODULE_KEY.COMMISSION,
  path: "commerce/commission",
  moduleClass: MODULE_CLASS.OPTIONAL,
  dependsOn: [MODULE_KEY.BOOKING, MODULE_KEY.PAYMENT],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: true,
  permissions: [
    permissionDefinition(PERMISSION_KEY.COMMISSION_RULE_READ),
    permissionDefinition(PERMISSION_KEY.COMMISSION_RULE_UPDATE),
    permissionDefinition(PERMISSION_KEY.COMMISSION_ENTRY_READ),
    permissionDefinition(PERMISSION_KEY.COMMISSION_ENTRY_READ_OWN),
  ],
  routes: {
    admin: ["/orgs/:organizationId/commission"],
  },
  menu: [],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [COMMISSION_EVENT_TYPE.ENTRY_RECORDED],
    consumes: [
      EVENT_TYPE.BOOKING_COMPLETED,
      EVENT_TYPE.PAYMENT_REFUNDED,
      EVENT_TYPE.PAYMENT_REVERSED,
    ],
  },
  limitKeys: [],
  sequenceKeys: [],
});
