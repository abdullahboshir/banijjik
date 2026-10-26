import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SETTINGS_TOPIC,
  SURFACE,
  permissionDefinition,
  LIMIT_KEY,
} from "@banijjik/contracts";
import { SMS_SETTING_KEY } from "@banijjik/contracts/sms";
import { defineModule } from "../../../kernel/modules/index.js";

export const smsManifest = defineModule({
  key: MODULE_KEY.SMS,
  path: "integration/sms",
  moduleClass: MODULE_CLASS.CORE,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.SMS_LOG_READ),
    permissionDefinition(PERMISSION_KEY.SMS_GATEWAY_READ),
    permissionDefinition(PERMISSION_KEY.SMS_CREDENTIAL_UPDATE, { isSensitive: true }),
  ],
  routes: {
    admin: [
      "/orgs/:organizationId/sms/gateway",
      "/orgs/:organizationId/sms/gateway/test",
      "/orgs/:organizationId/sms/logs",
    ],
    platform: ["/platform/sms-gateway", "/platform/sms-gateway/test"],
  },
  menu: [
    {
      menuKey: "sms.gateway",
      surface: SURFACE.ADMIN,
      groupKey: "settings",
      labelTermKey: "menu.sms.gateway",
      path: "settings/sms",
      iconKey: "bell",
      permissionKey: PERMISSION_KEY.SMS_GATEWAY_READ,
      order: 10,
      settingsTopicKey: SETTINGS_TOPIC.AUTOMATION,
    },
  ],
  settings: [
    {
      settingKey: SMS_SETTING_KEY.DAILY_LIMIT,
      value: { kind: "INTEGER", min: 0, max: 1000000 },
      systemDefault: 500,
      allowsLocationOverride: false,
      isClientVisible: false,
    },
  ],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [LIMIT_KEY.SMS_PER_MONTH],
  sequenceKeys: [],
});
