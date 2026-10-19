import {
  MODULE_CLASS,
  MODULE_KEY,
  OFFERING_KIND,
  PERMISSION_KEY,
  SEQUENCE_KEY,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import {
  INVENTORY_ADJUSTMENT_APPROVAL_ABOVE_SETTING_KEY,
  INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY,
  INVENTORY_EVENT_TYPE,
  INVENTORY_LOW_STOCK_DEFAULT_SETTING_KEY,
} from "@banijjik/contracts/inventory";
import { defineModule } from "../../../kernel/modules/index.js";

export const inventoryManifest = defineModule({
  key: MODULE_KEY.INVENTORY,
  path: "commerce/inventory",
  moduleClass: MODULE_CLASS.CORE,
  dependsOn: [MODULE_KEY.CATALOG],
  providesKinds: [],
  requiresAnyKind: [OFFERING_KIND.PRODUCT],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.INVENTORY_STOCK_READ),
    permissionDefinition(PERMISSION_KEY.INVENTORY_ITEM_UPDATE),
    permissionDefinition(PERMISSION_KEY.INVENTORY_ADJUSTMENT_CREATE),
    permissionDefinition(PERMISSION_KEY.INVENTORY_TRANSFER_CREATE),
    permissionDefinition(PERMISSION_KEY.INVENTORY_MOVEMENT_READ),
  ],
  routes: {
    admin: [
      "/orgs/:organizationId/inventory-items",
      "/orgs/:organizationId/stock",
      "/orgs/:organizationId/inventory/levels/rebuild",
    ],
  },
  menu: [
    {
      menuKey: "catalog.stock",
      surface: SURFACE.ADMIN,
      groupKey: "catalog",
      labelTermKey: "menu.catalog.stock",
      path: "catalog/stock",
      iconKey: "warehouse",
      permissionKey: PERMISSION_KEY.INVENTORY_STOCK_READ,
      order: 40,
    },
    {
      menuKey: "catalog.transfers",
      surface: SURFACE.ADMIN,
      groupKey: "catalog",
      labelTermKey: "menu.catalog.transfers",
      path: "catalog/transfers",
      iconKey: "truck",
      permissionKey: PERMISSION_KEY.INVENTORY_TRANSFER_CREATE,
      order: 50,
    },
    {
      menuKey: "catalog.adjustments",
      surface: SURFACE.ADMIN,
      groupKey: "catalog",
      labelTermKey: "menu.catalog.adjustments",
      path: "catalog/adjustments",
      iconKey: "sliders",
      permissionKey: PERMISSION_KEY.INVENTORY_ADJUSTMENT_CREATE,
      order: 60,
    },
  ],
  settings: [
    {
      settingKey: INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY,
      value: { kind: "BOOLEAN" },
      systemDefault: false,
      allowsLocationOverride: true,
      isClientVisible: true,
    },
    {
      settingKey: INVENTORY_LOW_STOCK_DEFAULT_SETTING_KEY,
      value: { kind: "INTEGER", min: 0, max: 1_000_000_000 },
      systemDefault: 0,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: INVENTORY_ADJUSTMENT_APPROVAL_ABOVE_SETTING_KEY,
      value: { kind: "INTEGER", min: 0, max: 1_000_000_000 },
      systemDefault: 0,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
  ],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [
      INVENTORY_EVENT_TYPE.STOCK_CHANGED,
      INVENTORY_EVENT_TYPE.STOCK_LOW,
      INVENTORY_EVENT_TYPE.TRANSFER_COMPLETED,
    ],
    consumes: [],
  },
  limitKeys: [],
  sequenceKeys: [SEQUENCE_KEY.TRANSFER],
});
