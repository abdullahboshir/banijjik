import {
  EVENT_TYPE,
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SEQUENCE_KEY,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import {
  EXPENSE_EVENT_TYPE,
  EXPENSE_REQUIRE_ATTACHMENT_ABOVE_DEFAULT,
  EXPENSE_REQUIRE_ATTACHMENT_ABOVE_SETTING_KEY,
} from "@banijjik/contracts/accounting";
import { defineModule } from "../../../kernel/modules/index.js";

/** The expense manifest in the shape of 10-MODULE-CATALOG section 2. */
export const expenseManifest = defineModule({
  key: MODULE_KEY.EXPENSE,
  path: "commerce/expense",
  moduleClass: MODULE_CLASS.CORE,
  dependsOn: [MODULE_KEY.FILE, MODULE_KEY.ACCOUNTING],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.EXPENSE_EXPENSE_READ),
    permissionDefinition(PERMISSION_KEY.EXPENSE_EXPENSE_CREATE),
    permissionDefinition(PERMISSION_KEY.EXPENSE_EXPENSE_VOID),
    permissionDefinition(PERMISSION_KEY.EXPENSE_CATEGORY_UPDATE),
  ],
  routes: {
    admin: ["/orgs/:organizationId/expenses", "/orgs/:organizationId/expense-categories"],
  },
  menu: [
    {
      menuKey: "expense.expenses",
      surface: SURFACE.ADMIN,
      groupKey: "money",
      labelTermKey: "menu.expense.expenses",
      path: "expenses",
      iconKey: "receipt",
      permissionKey: PERMISSION_KEY.EXPENSE_EXPENSE_READ,
      order: 20,
    },
    {
      menuKey: "expense.categories",
      surface: SURFACE.ADMIN,
      groupKey: "money",
      labelTermKey: "menu.expense.categories",
      path: "expenses/categories",
      iconKey: "tag",
      permissionKey: PERMISSION_KEY.EXPENSE_CATEGORY_UPDATE,
      order: 30,
    },
  ],
  settings: [
    {
      settingKey: EXPENSE_REQUIRE_ATTACHMENT_ABOVE_SETTING_KEY,
      // MONEY settings store integer minor units (buildSettingValueSchema); currency comes from the org.
      value: { kind: "MONEY", min: 0, max: 100_000_000_000 },
      systemDefault: EXPENSE_REQUIRE_ATTACHMENT_ABOVE_DEFAULT.amount,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
  ],
  customFieldEntities: ["expense"],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [EXPENSE_EVENT_TYPE.EXPENSE_POSTED, EXPENSE_EVENT_TYPE.EXPENSE_VOIDED],
    consumes: [EVENT_TYPE.ORGANIZATION_CREATED],
  },
  limitKeys: [],
  sequenceKeys: [SEQUENCE_KEY.EXPENSE],
});
