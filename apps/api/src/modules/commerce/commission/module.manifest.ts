import {
  EVENT_TYPE,
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SEQUENCE_KEY,
  SETTINGS_TOPIC,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import { COMMISSION_EVENT_TYPE } from "@banijjik/contracts/commission";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * The commission manifest (card 3.11, ADR-135). OPTIONAL: it is sold as the `ADDON_COMMISSION`
 * package.
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
    permissionDefinition(PERMISSION_KEY.COMMISSION_PAYOUT_READ),
    permissionDefinition(PERMISSION_KEY.COMMISSION_PAYOUT_CREATE),
  ],
  routes: {
    admin: ["/orgs/:organizationId/commission"],
  },
  menu: [
    {
      menuKey: "commission.entries",
      groupKey: "money",
      path: "commission/entries",
      permissionKey: PERMISSION_KEY.COMMISSION_ENTRY_READ,
      surface: SURFACE.ADMIN,
      labelTermKey: "menu.commission.entries",
      iconKey: "wallet",
      order: 70,
    },
    {
      menuKey: "commission.payouts",
      groupKey: "money",
      path: "commission/payouts",
      permissionKey: PERMISSION_KEY.COMMISSION_PAYOUT_READ,
      surface: SURFACE.ADMIN,
      labelTermKey: "menu.commission.payouts",
      iconKey: "banknote",
      order: 80,
    },
    {
      menuKey: "commission.rules",
      groupKey: "settings",
      path: "commission/rules",
      permissionKey: PERMISSION_KEY.COMMISSION_RULE_READ,
      surface: SURFACE.ADMIN,
      labelTermKey: "menu.commission.rules",
      iconKey: "sliders",
      order: 70,
      settingsTopicKey: SETTINGS_TOPIC.TEAM,
    },
  ],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [COMMISSION_EVENT_TYPE.ENTRY_RECORDED, COMMISSION_EVENT_TYPE.PAYOUT_PAID],
    consumes: [
      EVENT_TYPE.BOOKING_COMPLETED,
      EVENT_TYPE.ORDER_COMPLETED,
      EVENT_TYPE.PAYMENT_REFUNDED,
      EVENT_TYPE.PAYMENT_REVERSED,
    ],
  },
  limitKeys: [],
  sequenceKeys: [SEQUENCE_KEY.COMMISSION_PAYOUT],
});
