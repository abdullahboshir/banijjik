import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import { COURIER_DEFAULT_KEY_SETTING, COURIER_EVENT_TYPE } from "@banijjik/contracts/courier";
import { SALES_EVENT_TYPE } from "@banijjik/contracts/sales";
import { defineModule } from "../../../kernel/modules/index.js";

export const courierManifest = defineModule({
  key: MODULE_KEY.COURIER,
  path: "integration/courier",
  moduleClass: MODULE_CLASS.CORE,
  dependsOn: [MODULE_KEY.SALES],
  providesKinds: [],
  requiresAnyKind: ["PRODUCT"],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.COURIER_CONSIGNMENT_READ),
    permissionDefinition(PERMISSION_KEY.COURIER_CONSIGNMENT_CREATE),
    permissionDefinition(PERMISSION_KEY.COURIER_CONSIGNMENT_CANCEL),
    permissionDefinition(PERMISSION_KEY.COURIER_SETTLEMENT_READ),
    permissionDefinition(PERMISSION_KEY.COURIER_SETTLEMENT_RECORD),
    permissionDefinition(PERMISSION_KEY.COURIER_SETTLEMENT_REVERSE, { isSensitive: true }),
  ],
  routes: {
    admin: [
      "/orgs/:organizationId/courier/consignments",
      "/orgs/:organizationId/courier/settlements",
      "/orgs/:organizationId/courier/settlements/:courierSettlementId/reverse",
    ],
  },
  menu: [
    {
      menuKey: "courier.consignments",
      surface: SURFACE.ADMIN,
      groupKey: "commerce",
      labelTermKey: "menu.courier.consignments",
      path: "courier/consignments",
      iconKey: "truck",
      permissionKey: PERMISSION_KEY.COURIER_CONSIGNMENT_READ,
      order: 30,
    },
  ],
  settings: [
    {
      settingKey: COURIER_DEFAULT_KEY_SETTING,
      value: { kind: "ENUM", values: ["STEADFAST", "PATHAO", "REDX", "PAPERFLY", "OTHER"] },
      systemDefault: "STEADFAST",
      allowsLocationOverride: false,
      isClientVisible: true,
    },
  ],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [
      COURIER_EVENT_TYPE.CONSIGNMENT_CREATED,
      COURIER_EVENT_TYPE.CONSIGNMENT_CANCELLED,
      COURIER_EVENT_TYPE.SETTLEMENT_RECORDED,
      COURIER_EVENT_TYPE.SETTLEMENT_REVERSED,
    ],
    consumes: [SALES_EVENT_TYPE.ORDER_CONFIRMED],
  },
  limitKeys: [],
  sequenceKeys: [],
});
