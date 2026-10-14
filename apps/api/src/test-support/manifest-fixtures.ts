import { MODULE_CLASS, MODULE_KEY, type ModuleKey, type ModuleManifest } from "@banijjik/contracts";

/** A valid OPTIONAL manifest; tests override the parts they care about. */
export function aManifest(
  key: ModuleKey = MODULE_KEY.WORKFLOW,
  overrides: Partial<ModuleManifest> = {},
): ModuleManifest {
  return {
    key,
    path: `capability/${key}`,
    moduleClass: MODULE_CLASS.OPTIONAL,
    dependsOn: [],
    providesKinds: [],
    requiresAnyKind: [],
    tenantCanDisable: false,
    permissions: [],
    routes: {},
    menu: [],
    settings: [],
    customFieldEntities: [],
    botTools: [],
    storefrontSections: [],
    events: { emits: [], consumes: [] },
    limitKeys: [],
    sequenceKeys: [],
    ...overrides,
  };
}
