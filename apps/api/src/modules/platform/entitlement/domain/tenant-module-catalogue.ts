import {
  MODULE_CLASS,
  type ModuleKey,
  type ModuleManifest,
  type TenantModuleView,
} from "@banijjik/contracts";

export interface TenantModuleCatalogueInput {
  readonly manifests: readonly ModuleManifest[];
  readonly allowedModuleKeys: readonly ModuleKey[];
  readonly packageModuleKeys: readonly ModuleKey[];
  readonly effectiveModuleKeys: ReadonlySet<ModuleKey>;
  readonly disabledModuleKeys: ReadonlySet<ModuleKey>;
}

function isOffered(
  manifest: ModuleManifest,
  allowed: ReadonlySet<ModuleKey>,
  purchased: ReadonlySet<ModuleKey>,
): boolean {
  if (
    manifest.moduleClass !== MODULE_CLASS.CORE &&
    manifest.moduleClass !== MODULE_CLASS.OPTIONAL
  ) {
    return false;
  }
  if (!allowed.has(manifest.key)) return false;
  return manifest.moduleClass === MODULE_CLASS.CORE || purchased.has(manifest.key);
}

function requiredBy(
  moduleKey: ModuleKey,
  manifests: readonly ModuleManifest[],
  effective: ReadonlySet<ModuleKey>,
): ModuleKey[] {
  return manifests
    .filter((manifest) => effective.has(manifest.key) && manifest.dependsOn.includes(moduleKey))
    .map((manifest) => manifest.key)
    .sort();
}

/** CORE and OPTIONAL modules the package and the template both offer, ordered by key (ADR-104). */
export function buildTenantModuleCatalogue(input: TenantModuleCatalogueInput): TenantModuleView[] {
  const allowed = new Set(input.allowedModuleKeys);
  const purchased = new Set(input.packageModuleKeys);
  return input.manifests
    .filter((manifest) => isOffered(manifest, allowed, purchased))
    .map((manifest) => ({
      moduleKey: manifest.key,
      moduleClass: manifest.moduleClass,
      isEffective: input.effectiveModuleKeys.has(manifest.key),
      tenantCanDisable: manifest.tenantCanDisable,
      isDisabledByTenant: input.disabledModuleKeys.has(manifest.key),
      requiredBy: requiredBy(manifest.key, input.manifests, input.effectiveModuleKeys),
    }))
    .sort((left, right) => left.moduleKey.localeCompare(right.moduleKey, "en"));
}
