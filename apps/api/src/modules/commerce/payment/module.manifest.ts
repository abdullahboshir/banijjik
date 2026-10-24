import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SEQUENCE_KEY,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import {
  CLOSED_REQUEST_REVERSAL_POLICY,
  PAYMENT_EVENT_TYPE,
  PAYMENT_METHODS_DEFAULT,
  PAYMENT_METHODS_SETTING_KEY,
  PAYMENT_REFUND_MANAGER_WITHOUT_APPROVAL_SETTING_KEY,
  PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY,
  PAYMENT_STORE_CREDIT_EXPIRY_DAYS_SETTING_KEY,
} from "@banijjik/contracts/payment";
import { defineModule } from "../../../kernel/modules/index.js";

export const paymentManifest = defineModule({
  key: MODULE_KEY.PAYMENT,
  path: "commerce/payment",
  moduleClass: MODULE_CLASS.CORE,
  dependsOn: [MODULE_KEY.CONTACT],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.PAYMENT_PAYMENT_READ),
    permissionDefinition(PERMISSION_KEY.PAYMENT_PAYMENT_RECEIVE),
    permissionDefinition(PERMISSION_KEY.PAYMENT_PAYMENT_REFUND, { isSensitive: true }),
    permissionDefinition(PERMISSION_KEY.PAYMENT_PAYMENT_REFUND_WITHOUT_APPROVAL, {
      isSensitive: true,
    }),
    permissionDefinition(PERMISSION_KEY.PAYMENT_PAYMENT_REVERSE, { isSensitive: true }),
    permissionDefinition(PERMISSION_KEY.PAYMENT_DUE_READ),
    permissionDefinition(PERMISSION_KEY.PAYMENT_STORE_CREDIT_READ),
    permissionDefinition(PERMISSION_KEY.PAYMENT_STORE_CREDIT_ADJUST, { isSensitive: true }),
  ],
  routes: {
    admin: [
      "/orgs/:organizationId/payments",
      "/orgs/:organizationId/refunds",
      "/orgs/:organizationId/dues",
      "/orgs/:organizationId/store-credit",
    ],
  },
  menu: [
    {
      menuKey: "payment.payments",
      surface: SURFACE.ADMIN,
      groupKey: "money",
      labelTermKey: "menu.payment.payments",
      path: "payments",
      iconKey: "banknote",
      permissionKey: PERMISSION_KEY.PAYMENT_PAYMENT_READ,
      order: 30,
    },
  ],
  settings: [
    {
      settingKey: PAYMENT_METHODS_SETTING_KEY,
      value: { kind: "STRUCTURED", schemaKey: "payment.methods" },
      systemDefault: PAYMENT_METHODS_DEFAULT,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: PAYMENT_REFUND_MANAGER_WITHOUT_APPROVAL_SETTING_KEY,
      value: { kind: "BOOLEAN" },
      systemDefault: true,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: PAYMENT_STORE_CREDIT_EXPIRY_DAYS_SETTING_KEY,
      value: { kind: "INTEGER", min: 1, max: 3650 },
      systemDefault: 365,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: PAYMENT_REVERSAL_CLOSED_REQUEST_SETTING_KEY,
      value: { kind: "ENUM", values: Object.values(CLOSED_REQUEST_REVERSAL_POLICY) },
      systemDefault: CLOSED_REQUEST_REVERSAL_POLICY.REOPEN_DUE,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
  ],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: Object.values(PAYMENT_EVENT_TYPE),
    consumes: [],
  },
  limitKeys: [],
  sequenceKeys: [SEQUENCE_KEY.PAYMENT],
});
