import {
  MODULE_CLASS,
  MODULE_KEY,
  OFFERING_KIND,
  PERMISSION_KEY,
  SEQUENCE_KEY,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import { ENROLLMENT_EVENT_TYPE, ENROLLMENT_SETTING } from "@banijjik/contracts/enrollment";
import { defineModule } from "../../../kernel/modules/index.js";

const integerSetting = (settingKey: string, systemDefault: number) => ({
  settingKey,
  value: { kind: "INTEGER" as const, min: 0, max: 365 },
  systemDefault,
  allowsLocationOverride: false,
  isClientVisible: true,
});
const booleanSetting = (settingKey: string, systemDefault: boolean) => ({
  settingKey,
  value: { kind: "BOOLEAN" as const },
  systemDefault,
  allowsLocationOverride: false,
  isClientVisible: true,
});
export const enrollmentManifest = defineModule({
  key: MODULE_KEY.ENROLLMENT,
  path: "commerce/enrollment",
  moduleClass: MODULE_CLASS.CORE,
  dependsOn: [MODULE_KEY.CATALOG, MODULE_KEY.CONTACT, MODULE_KEY.PRICING, MODULE_KEY.BOOKING],
  providesKinds: [OFFERING_KIND.PLAN],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    PERMISSION_KEY.ENROLLMENT_ENROLLMENT_READ,
    PERMISSION_KEY.ENROLLMENT_ENROLLMENT_CREATE,
    PERMISSION_KEY.ENROLLMENT_ENROLLMENT_UPDATE,
    PERMISSION_KEY.ENROLLMENT_ENROLLMENT_RENEW,
    PERMISSION_KEY.ENROLLMENT_ENROLLMENT_CANCEL,
    PERMISSION_KEY.ENROLLMENT_CHECK_IN_CREATE,
  ].map((key) => permissionDefinition(key)),
  routes: { admin: ["/orgs/:organizationId/enrollments", "/orgs/:organizationId/check-ins"] },
  menu: [
    {
      menuKey: "enrollment.enrollments",
      surface: SURFACE.ADMIN,
      groupKey: "enrollments",
      labelTermKey: "menu.enrollment.enrollments",
      termKey: "enrollment",
      path: "enrollments",
      iconKey: "users",
      permissionKey: PERMISSION_KEY.ENROLLMENT_ENROLLMENT_READ,
      order: 10,
    },
    {
      menuKey: "enrollment.checkIns",
      surface: SURFACE.ADMIN,
      groupKey: "enrollments",
      labelTermKey: "menu.enrollment.checkIns",
      path: "check-ins",
      iconKey: "check",
      permissionKey: PERMISSION_KEY.ENROLLMENT_CHECK_IN_CREATE,
      order: 20,
    },
  ],
  settings: [
    integerSetting(ENROLLMENT_SETTING.GRACE_DAYS, 5),
    integerSetting(ENROLLMENT_SETTING.REMINDER_DAYS, 3),
    booleanSetting(ENROLLMENT_SETTING.REQUIRE_PAYMENT, true),
    booleanSetting(ENROLLMENT_SETTING.BLOCK_OVERDUE, true),
    booleanSetting(ENROLLMENT_SETTING.LOCK_PRICE, false),
    {
      settingKey: ENROLLMENT_SETTING.REFUND_POLICY,
      value: { kind: "TEXT", maxLength: 32 },
      systemDefault: "NONE",
      allowsLocationOverride: false,
      isClientVisible: true,
    },
  ],
  customFieldEntities: ["enrollment"],
  botTools: [],
  storefrontSections: [],
  events: { emits: Object.values(ENROLLMENT_EVENT_TYPE), consumes: [] },
  limitKeys: [],
  sequenceKeys: [SEQUENCE_KEY.ENROLLMENT],
});
