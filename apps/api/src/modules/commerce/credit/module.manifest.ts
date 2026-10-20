import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import { CREDIT_EVENT_TYPE, CREDIT_RULE_KEY } from "@banijjik/contracts/credit";
import { defineModule } from "../../../kernel/modules/index.js";

/** The credit manifest (doc 16 §3.5, M.4 plan). */
export const creditManifest = defineModule({
  key: MODULE_KEY.CREDIT,
  path: "commerce/credit",
  moduleClass: MODULE_CLASS.OPTIONAL,
  dependsOn: [MODULE_KEY.DIRECTORY],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: true,
  permissions: [
    permissionDefinition(PERMISSION_KEY.CREDIT_PACK_READ),
    permissionDefinition(PERMISSION_KEY.CREDIT_PACK_UPDATE),
    permissionDefinition(PERMISSION_KEY.CREDIT_ACCOUNT_READ),
    permissionDefinition(PERMISSION_KEY.CREDIT_ACCOUNT_ADJUST),
  ],
  routes: {
    admin: ["/orgs/:organizationId/credit"],
    storefront: [
      "/storefront/orgs/:organizationId/my/credits",
      "/storefront/orgs/:organizationId/my/unlocks",
      "/storefront/orgs/:organizationId/credit-packs",
    ],
  },
  menu: [
    {
      menuKey: "credit.packs",
      surface: SURFACE.ADMIN,
      groupKey: "sales",
      labelTermKey: "menu.credit.packs",
      termKey: "creditPack",
      path: "credit/packs",
      iconKey: "coins",
      permissionKey: PERMISSION_KEY.CREDIT_PACK_READ,
      order: 50,
    },
  ],
  settings: [
    {
      settingKey: CREDIT_RULE_KEY.UNLOCK_COST,
      value: { kind: "INTEGER", min: 1, max: 1000 },
      systemDefault: 1,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: CREDIT_RULE_KEY.UNLOCKS_PER_DAY,
      value: { kind: "INTEGER", min: 1, max: 1000 },
      systemDefault: 20,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: CREDIT_RULE_KEY.SHOW_UNLOCKERS_TO_OWNER,
      value: { kind: "BOOLEAN" },
      systemDefault: false,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
  ],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: ["credit-packs"],
  events: {
    emits: [CREDIT_EVENT_TYPE.CREDIT_ENTRY_CREATED, CREDIT_EVENT_TYPE.UNLOCK_CREATED],
    consumes: [],
  },
  limitKeys: [],
  sequenceKeys: [],
});
