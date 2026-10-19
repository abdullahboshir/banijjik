import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SETTINGS_TOPIC,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import {
  DEFAULT_APPROVAL_DISCOUNT_AMOUNT_ABOVE,
  DEFAULT_APPROVAL_DISCOUNT_PERCENT_ABOVE,
  PRICING_APPROVAL_DISCOUNT_AMOUNT_ABOVE_SETTING_KEY,
  PRICING_APPROVAL_DISCOUNT_PERCENT_ABOVE_SETTING_KEY,
  PRICING_DEFAULT_TAX_CLASS_KEY_SETTING_KEY,
  PRICING_EVENT_TYPE,
  PRICING_ROUNDING,
  PRICING_ROUNDING_SETTING_KEY,
  PRICING_TAX_INCLUSIVE_SETTING_KEY,
  TAX_CLASS_KEY_MAX_LENGTH,
} from "@banijjik/contracts/pricing";
import { defineModule } from "../../../kernel/modules/index.js";

/** The pricing manifest in the shape of 10-MODULE-CATALOG section 2. */
export const pricingManifest = defineModule({
  key: MODULE_KEY.PRICING,
  path: "commerce/pricing",
  moduleClass: MODULE_CLASS.CORE,
  dependsOn: [MODULE_KEY.CATALOG],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.PRICING_PROMOTION_READ),
    permissionDefinition(PERMISSION_KEY.PRICING_PROMOTION_CREATE),
    permissionDefinition(PERMISSION_KEY.PRICING_PROMOTION_UPDATE),
    permissionDefinition(PERMISSION_KEY.PRICING_PROMOTION_ARCHIVE),
    permissionDefinition(PERMISSION_KEY.PRICING_TAX_CLASS_UPDATE),
  ],
  routes: {
    admin: [
      "/orgs/:organizationId/tax-classes",
      "/orgs/:organizationId/promotions",
      "/orgs/:organizationId/quotes",
    ],
  },
  menu: [
    {
      menuKey: "catalog.promotions",
      surface: SURFACE.ADMIN,
      groupKey: "catalog",
      labelTermKey: "menu.catalog.promotions",
      path: "catalog/promotions",
      iconKey: "tag",
      permissionKey: PERMISSION_KEY.PRICING_PROMOTION_READ,
      order: 40,
    },
    {
      menuKey: "pricing.taxClasses",
      surface: SURFACE.ADMIN,
      groupKey: "settings",
      labelTermKey: "menu.pricing.taxClasses",
      path: "settings/tax-classes",
      iconKey: "receipt",
      permissionKey: PERMISSION_KEY.PRICING_TAX_CLASS_UPDATE,
      // After settings.general (50); terms is 60.
      order: 55,
      settingsTopicKey: SETTINGS_TOPIC.SALES,
    },
  ],
  settings: [
    {
      settingKey: PRICING_TAX_INCLUSIVE_SETTING_KEY,
      value: { kind: "BOOLEAN" },
      systemDefault: true,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: PRICING_ROUNDING_SETTING_KEY,
      value: { kind: "ENUM", values: Object.values(PRICING_ROUNDING) },
      systemDefault: PRICING_ROUNDING.NONE,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: PRICING_APPROVAL_DISCOUNT_PERCENT_ABOVE_SETTING_KEY,
      value: { kind: "INTEGER", min: 0, max: 100_000 },
      systemDefault: DEFAULT_APPROVAL_DISCOUNT_PERCENT_ABOVE,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: PRICING_APPROVAL_DISCOUNT_AMOUNT_ABOVE_SETTING_KEY,
      value: { kind: "MONEY", min: 0, max: Number.MAX_SAFE_INTEGER },
      systemDefault: DEFAULT_APPROVAL_DISCOUNT_AMOUNT_ABOVE,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: PRICING_DEFAULT_TAX_CLASS_KEY_SETTING_KEY,
      value: { kind: "TEXT", maxLength: TAX_CLASS_KEY_MAX_LENGTH },
      systemDefault: "",
      allowsLocationOverride: false,
      isClientVisible: true,
    },
  ],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [PRICING_EVENT_TYPE.PROMOTION_CHANGED],
    consumes: [],
  },
  limitKeys: [],
  sequenceKeys: [],
});
