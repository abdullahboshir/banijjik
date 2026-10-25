import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  permissionDefinition,
} from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";
import { REPORT_HANDLED_EVENT_TYPES } from "./application/event-increments.js";

/**
 * The report manifest (card 3.10, ADR-147). CORE and not disableable: every business has a home.
 * It has no settings and no menu entry yet; the screens and their menu arrive with Part B.
 */
export const reportManifest = defineModule({
  key: MODULE_KEY.REPORT,
  path: "commerce/report",
  moduleClass: MODULE_CLASS.CORE,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [
    permissionDefinition(PERMISSION_KEY.REPORT_HOME_READ),
    permissionDefinition(PERMISSION_KEY.REPORT_DAILY_READ),
  ],
  routes: {
    admin: ["/orgs/:organizationId/reports/home", "/orgs/:organizationId/reports/daily"],
  },
  menu: [],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: {
    emits: [],
    consumes: REPORT_HANDLED_EVENT_TYPES,
  },
  limitKeys: [],
  sequenceKeys: [],
});
