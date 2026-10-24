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
import {
  ACCOUNTING_EVENT_TYPE,
  ACCOUNTING_FISCAL_YEAR_START_DEFAULT,
  ACCOUNTING_FISCAL_YEAR_START_SETTING_KEY,
} from "@banijjik/contracts/accounting";
import { COMMISSION_EVENT_TYPE } from "@banijjik/contracts/commission";
import { defineModule } from "../../../kernel/modules/index.js";

/** The accounting manifest in the shape of 10-MODULE-CATALOG section 2 (SYSTEM; trial-balance check only). */
export const accountingManifest = defineModule({
  key: MODULE_KEY.ACCOUNTING,
  path: "commerce/accounting",
  moduleClass: MODULE_CLASS.SYSTEM,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [permissionDefinition(PERMISSION_KEY.ACCOUNTING_LEDGER_READ, { isSensitive: true })],
  routes: {
    admin: [
      "/orgs/:organizationId/accounting/accounts",
      "/orgs/:organizationId/accounting/journal",
      "/orgs/:organizationId/accounting/trial-balance",
    ],
  },
  menu: [
    {
      menuKey: "accounting.trialBalance",
      hiddenWhenModuleEnabled: MODULE_KEY.BOOKKEEPING,
      surface: SURFACE.ADMIN,
      groupKey: "settings",
      labelTermKey: "menu.accounting.trialBalance",
      path: "settings/trial-balance",
      iconKey: "wallet",
      permissionKey: PERMISSION_KEY.ACCOUNTING_LEDGER_READ,
      order: 90,
      settingsTopicKey: SETTINGS_TOPIC.ADVANCED,
    },
  ],
  settings: [
    {
      settingKey: ACCOUNTING_FISCAL_YEAR_START_SETTING_KEY,
      value: { kind: "INTEGER", min: 1, max: 366 },
      systemDefault: ACCOUNTING_FISCAL_YEAR_START_DEFAULT,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
  ],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [ACCOUNTING_EVENT_TYPE.JOURNAL_POSTED],
    consumes: [
      EVENT_TYPE.ORGANIZATION_CREATED,
      EVENT_TYPE.PAYMENT_RECEIVED,
      EVENT_TYPE.PAYMENT_REFUNDED,
      EVENT_TYPE.PAYMENT_REVERSED,
      EVENT_TYPE.STORE_CREDIT_CHANGED,
      EVENT_TYPE.BOOKING_COMPLETED,
      EVENT_TYPE.BOOKING_CANCELLED,
      EVENT_TYPE.EXPENSE_POSTED,
      EVENT_TYPE.EXPENSE_VOIDED,
      COMMISSION_EVENT_TYPE.ENTRY_RECORDED,
      COMMISSION_EVENT_TYPE.PAYOUT_PAID,
    ],
  },
  limitKeys: [],
  sequenceKeys: [SEQUENCE_KEY.JOURNAL],
});
