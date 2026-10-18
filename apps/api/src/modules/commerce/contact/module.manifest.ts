import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import {
  CONTACT_DEDUPE_MODE,
  CONTACT_DEDUPE_SETTING_KEY,
  CONTACT_EVENT_TYPE,
  CUSTOMER_LOGIN_SETTING_KEY,
} from "@banijjik/contracts/contact";
import { defineModule } from "../../../kernel/modules/index.js";

/** The contact manifest in the shape of 10-MODULE-CATALOG section 2. */
export const contactManifest = defineModule({
  key: MODULE_KEY.CONTACT,
  path: "commerce/contact",
  moduleClass: MODULE_CLASS.CORE,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.CONTACT_CONTACT_READ),
    permissionDefinition(PERMISSION_KEY.CONTACT_CONTACT_CREATE),
    permissionDefinition(PERMISSION_KEY.CONTACT_CONTACT_UPDATE),
    permissionDefinition(PERMISSION_KEY.CONTACT_CONTACT_ARCHIVE),
    permissionDefinition(PERMISSION_KEY.CONTACT_CONTACT_ANONYMIZE, { isSensitive: true }),
    permissionDefinition(PERMISSION_KEY.CONTACT_CONTACT_READ_SENSITIVE, { isSensitive: true }),
    permissionDefinition(PERMISSION_KEY.CONTACT_CUSTOMER_ACCOUNT_READ),
    permissionDefinition(PERMISSION_KEY.CONTACT_CUSTOMER_ACCOUNT_BLOCK),
  ],
  routes: { admin: ["/orgs/:organizationId/contacts"] },
  menu: [
    {
      menuKey: "contact.contacts",
      surface: SURFACE.ADMIN,
      groupKey: "contacts",
      labelTermKey: "menu.contact.contacts",
      termKey: "contact",
      path: "contacts",
      iconKey: "users",
      permissionKey: PERMISSION_KEY.CONTACT_CONTACT_READ,
      order: 10,
    },
  ],
  settings: [
    {
      settingKey: CONTACT_DEDUPE_SETTING_KEY,
      value: { kind: "ENUM", values: Object.values(CONTACT_DEDUPE_MODE) },
      systemDefault: CONTACT_DEDUPE_MODE.PHONE,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
    {
      settingKey: CUSTOMER_LOGIN_SETTING_KEY,
      value: { kind: "BOOLEAN" },
      systemDefault: false,
      allowsLocationOverride: false,
      isClientVisible: true,
    },
  ],
  customFieldEntities: ["contact"],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [
      CONTACT_EVENT_TYPE.CONTACT_CREATED,
      CONTACT_EVENT_TYPE.CONTACT_UPDATED,
      CONTACT_EVENT_TYPE.CONTACT_ARCHIVED,
      CONTACT_EVENT_TYPE.CONTACT_ANONYMIZED,
      CONTACT_EVENT_TYPE.CUSTOMER_OTP_REQUESTED,
      CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_BLOCKED,
      CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_UNBLOCKED,
      CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_ENDED,
    ],
    consumes: [],
  },
  limitKeys: [],
  sequenceKeys: [],
});
