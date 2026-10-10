import { PERMISSION_KEY, permissionDefinition } from "@banijjik/contracts";

/**
 * The audit manifest in the shape of 10-MODULE-CATALOG section 2. `defineModule` and its
 * validation arrive with card 1.6; until then this is a plain object. The `audit.retentionDays`
 * setting arrives with the settings module (card 2.x).
 */
export const auditManifest = {
  key: "audit",
  path: "core/audit",
  moduleClass: "SYSTEM",
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [permissionDefinition(PERMISSION_KEY.AUDIT_LOG_READ, { isSensitive: true })],
  routes: { admin: ["/audit-logs"] },
  menu: [],
  settingKeys: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
} as const;
