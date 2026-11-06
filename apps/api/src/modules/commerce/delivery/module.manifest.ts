import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import { DELIVERY_EVENT_TYPE } from "@banijjik/contracts/delivery";
import { SALES_EVENT_TYPE } from "@banijjik/contracts/sales";
import { defineModule } from "../../../kernel/modules/index.js";

export const deliveryManifest = defineModule({
  key: MODULE_KEY.DELIVERY,
  path: "commerce/delivery",
  moduleClass: MODULE_CLASS.CORE,
  dependsOn: [MODULE_KEY.SALES],
  providesKinds: [],
  requiresAnyKind: ["PRODUCT"],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.DELIVERY_ASSIGNMENT_READ),
    permissionDefinition(PERMISSION_KEY.DELIVERY_ASSIGNMENT_CREATE),
    permissionDefinition(PERMISSION_KEY.DELIVERY_ASSIGNMENT_UPDATE),
    permissionDefinition(PERMISSION_KEY.DELIVERY_HANDOVER_READ),
    permissionDefinition(PERMISSION_KEY.DELIVERY_HANDOVER_RECORD),
    permissionDefinition(PERMISSION_KEY.DELIVERY_HANDOVER_REVERSE, { isSensitive: true }),
  ],
  routes: {
    admin: [
      "/orgs/:organizationId/delivery/assignments",
      "/orgs/:organizationId/delivery/handovers",
      "/orgs/:organizationId/delivery/handovers/:riderCashHandoverId/reverse",
    ],
  },
  menu: [
    {
      menuKey: "delivery.assignments",
      surface: SURFACE.ADMIN,
      groupKey: "commerce",
      labelTermKey: "menu.delivery.assignments",
      path: "delivery/assignments",
      iconKey: "bicycle",
      permissionKey: PERMISSION_KEY.DELIVERY_ASSIGNMENT_READ,
      order: 35,
    },
  ],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [
      DELIVERY_EVENT_TYPE.ASSIGNMENT_CREATED,
      DELIVERY_EVENT_TYPE.ASSIGNMENT_UPDATED,
      DELIVERY_EVENT_TYPE.HANDOVER_RECORDED,
      DELIVERY_EVENT_TYPE.HANDOVER_REVERSED,
    ],
    consumes: [SALES_EVENT_TYPE.ORDER_CONFIRMED],
  },
  limitKeys: [],
  sequenceKeys: [],
});
