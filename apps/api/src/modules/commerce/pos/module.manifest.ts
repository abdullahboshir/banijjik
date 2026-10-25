import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  SEQUENCE_KEY,
  SURFACE,
  permissionDefinition,
} from "@banijjik/contracts";
import {
  POS_ALLOW_CREDIT_SALE_DEFAULT,
  POS_ALLOW_CREDIT_SALE_SETTING_KEY,
  POS_EVENT_TYPE,
  POS_RECEIPT_FOOTER_DEFAULT,
  POS_RECEIPT_FOOTER_MAX_LENGTH,
  POS_RECEIPT_FOOTER_SETTING_KEY,
  POS_REQUIRE_SHIFT_DEFAULT,
  POS_REQUIRE_SHIFT_SETTING_KEY,
} from "@banijjik/contracts/pos";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * The POS manifest (card 3.9, ADR-146). OPTIONAL: it is sold with the shop packages and as the
 * `ADDON_POS` add-on. The screens arrive with Part B, so no menu entry is declared yet.
 */
export const posManifest = defineModule({
  key: MODULE_KEY.POS,
  path: "commerce/pos",
  moduleClass: MODULE_CLASS.OPTIONAL,
  dependsOn: [MODULE_KEY.SALES, MODULE_KEY.PAYMENT],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: true,
  permissions: [
    permissionDefinition(PERMISSION_KEY.POS_DEVICE_MANAGE, { surface: SURFACE.POS }),
    permissionDefinition(PERMISSION_KEY.POS_SESSION_OPEN, { surface: SURFACE.POS }),
    permissionDefinition(PERMISSION_KEY.POS_SALE_CREATE, { surface: SURFACE.POS }),
    permissionDefinition(PERMISSION_KEY.POS_REGISTER_CLOSE, { surface: SURFACE.POS }),
    permissionDefinition(PERMISSION_KEY.POS_REPORT_READ, { surface: SURFACE.POS }),
  ],
  routes: {
    admin: ["/orgs/:organizationId/pos"],
  },
  menu: [],
  settings: [
    {
      settingKey: POS_REQUIRE_SHIFT_SETTING_KEY,
      value: { kind: "BOOLEAN" },
      systemDefault: POS_REQUIRE_SHIFT_DEFAULT,
      allowsLocationOverride: true,
      isClientVisible: true,
    },
    {
      settingKey: POS_ALLOW_CREDIT_SALE_SETTING_KEY,
      value: { kind: "BOOLEAN" },
      systemDefault: POS_ALLOW_CREDIT_SALE_DEFAULT,
      allowsLocationOverride: true,
      isClientVisible: true,
    },
    {
      settingKey: POS_RECEIPT_FOOTER_SETTING_KEY,
      value: { kind: "TEXT", maxLength: POS_RECEIPT_FOOTER_MAX_LENGTH },
      systemDefault: POS_RECEIPT_FOOTER_DEFAULT,
      allowsLocationOverride: true,
      isClientVisible: true,
    },
  ],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: Object.values(POS_EVENT_TYPE),
    consumes: [],
  },
  limitKeys: [],
  sequenceKeys: [SEQUENCE_KEY.ZREPORT],
});
