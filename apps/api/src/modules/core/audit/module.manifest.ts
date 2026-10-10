import {
  MODULE_CLASS,
  MODULE_KEY,
  PERMISSION_KEY,
  permissionDefinition,
} from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * The audit manifest in the shape of 10-MODULE-CATALOG section 2. The `audit.retentionDays`
 * setting arrives with the settings module (card 2.x).
 */
export const auditManifest = defineModule({
  key: MODULE_KEY.AUDIT,
  path: "core/audit",
  moduleClass: MODULE_CLASS.SYSTEM,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [permissionDefinition(PERMISSION_KEY.AUDIT_LOG_READ, { isSensitive: true })],
  routes: { admin: ["/orgs/:organizationId/audit-logs"] },
  menu: [],
  settingKeys: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});
