import {
  MODULE_CLASS,
  MODULE_KEY,
  SURFACE,
  type ModuleKey,
  type ModuleManifest,
  type PermissionKey,
} from "@banijjik/contracts";
import { defineModule } from "../kernel/modules/index.js";

/** Everything a probe manifest does not set: no permissions, menu, settings, events or limits. */
const EMPTY_MANIFEST_PARTS = {
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  permissions: [],
  menu: [],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
} as const;

/**
 * The module that owns the routes of the kernel probe routers (/probe, /notes, /guarded). It is a
 * SYSTEM module under a catalogue key that no real module uses yet, so the fail-closed entitlement
 * gate lets the probes through exactly as it would a SYSTEM module. `settings` is the real module
 * now, so the probe uses `file` until that module arrives.
 */
export const KERNEL_PROBE_MANIFEST: ModuleManifest = defineModule({
  ...EMPTY_MANIFEST_PARTS,
  key: MODULE_KEY.FILE,
  path: "core/file",
  moduleClass: MODULE_CLASS.SYSTEM,
  tenantCanDisable: false,
  routes: {
    admin: [
      "/orgs/:organizationId/probe",
      "/orgs/:organizationId/notes",
      "/orgs/:organizationId/guarded",
    ],
  },
});

export interface OptionalProbeOptions {
  /** A catalogue key that no real module uses yet. */
  readonly key: ModuleKey;
  readonly routePrefix: string;
  readonly tenantCanDisable?: boolean;
  /** One menu entry per permission key; the entry shows for a caller who holds its permission. */
  readonly menuPermissionKeys?: readonly PermissionKey[];
}

/** An OPTIONAL probe module with one tenant route, for the entitlement tests (card 1.6a). */
export function optionalProbeManifest(options: OptionalProbeOptions): ModuleManifest {
  const menu = (options.menuPermissionKeys ?? []).map((permissionKey, index) => ({
    menuKey: `probe.${options.key}.${permissionKey}`,
    surface: SURFACE.ADMIN,
    groupKey: "settings",
    labelTermKey: `menu.probe.${options.key}`,
    path: options.routePrefix,
    iconKey: "probe",
    permissionKey,
    order: index + 1,
  }));
  return defineModule({
    ...EMPTY_MANIFEST_PARTS,
    key: options.key,
    path: `capability/${options.key}`,
    moduleClass: MODULE_CLASS.OPTIONAL,
    tenantCanDisable: options.tenantCanDisable ?? true,
    routes: { admin: [`/orgs/:organizationId${options.routePrefix}`] },
    menu,
  });
}
