import {
  isPermissionKey,
  MODULE_CLASS,
  permissionModuleKey,
  SURFACE,
  type ModuleKey,
  type ModuleManifest,
  type SettingDefinition,
} from "@banijjik/contracts";
import { buildSettingValueSchema, structuredSettingSchema } from "@banijjik/validation";
import { ManifestError } from "./manifest-error.js";
import { allRoutePrefixes, routeShape } from "./route-prefix.js";

function assertKeysAreUnique(manifests: readonly ModuleManifest[]): void {
  const seen = new Set<ModuleKey>();
  for (const { key } of manifests) {
    if (seen.has(key)) throw new ManifestError(`duplicate module key ${key}`);
    seen.add(key);
  }
}

function assertPermissionsBelongToModule(manifest: ModuleManifest): void {
  for (const { permissionKey } of manifest.permissions) {
    if (!isPermissionKey(permissionKey)) {
      throw new ManifestError(`${manifest.key}: unknown permission key ${permissionKey}`);
    }
    if (permissionModuleKey(permissionKey) !== manifest.key) {
      throw new ManifestError(`${manifest.key}: ${permissionKey} belongs to another module`);
    }
  }
}

function assertPlatformModuleStaysOnPlatform(manifest: ModuleManifest): void {
  if (manifest.moduleClass !== MODULE_CLASS.PLATFORM) return;
  const { admin, storefront, webhook } = manifest.routes;
  const hasTenantRoutes = [admin, storefront, webhook].some((list) => (list?.length ?? 0) > 0);
  const hasOtherMenu = manifest.menu.some((entry) => entry.surface !== SURFACE.PLATFORM);
  if (hasTenantRoutes || hasOtherMenu) {
    throw new ManifestError(
      `${manifest.key}: a PLATFORM module declares platform routes and menu only`,
    );
  }
}

function assertOnlyOptionalModulesCanBeDisabled(manifest: ModuleManifest): void {
  if (manifest.tenantCanDisable && manifest.moduleClass !== MODULE_CLASS.OPTIONAL) {
    throw new ManifestError(`${manifest.key}: tenantCanDisable is for OPTIONAL modules only`);
  }
}

function assertRoutePrefixesAreUnique(manifests: readonly ModuleManifest[]): void {
  const ownerOfShape = new Map<string, ModuleKey>();
  for (const { prefix, owner } of manifests.flatMap(allRoutePrefixes)) {
    const shape = routeShape(prefix);
    if (ownerOfShape.has(shape)) {
      throw new ManifestError(
        `route ${prefix} is declared by ${ownerOfShape.get(shape)} and ${owner.key}`,
      );
    }
    ownerOfShape.set(shape, owner.key);
  }
}

function findCycle(
  manifest: ModuleManifest,
  byKey: ReadonlyMap<ModuleKey, ModuleManifest>,
): boolean {
  const visiting = new Set<ModuleKey>();
  const visit = (key: ModuleKey): boolean => {
    if (visiting.has(key)) return true;
    visiting.add(key);
    const dependencies = byKey.get(key)?.dependsOn ?? [];
    const isCyclic = dependencies.some(visit);
    visiting.delete(key);
    return isCyclic;
  };
  return visit(manifest.key);
}

function assertSettingKeysAreUnique(manifests: readonly ModuleManifest[]): void {
  const ownerOfKey = new Map<string, ModuleKey>();
  for (const manifest of manifests) {
    for (const { settingKey } of manifest.settings) {
      const owner = ownerOfKey.get(settingKey);
      if (owner !== undefined) {
        throw new ManifestError(
          `duplicate setting key ${settingKey} (${owner} and ${manifest.key})`,
        );
      }
      ownerOfKey.set(settingKey, manifest.key);
    }
  }
}

function assertSettingKeyBelongsToModule(
  manifest: ModuleManifest,
  setting: SettingDefinition,
): void {
  if (!setting.settingKey.startsWith(`${manifest.key}.`)) {
    throw new ManifestError(
      `${manifest.key}: ${setting.settingKey} does not start with the module key`,
    );
  }
}

function assertStructuredSchemaIsKnown(manifest: ModuleManifest, setting: SettingDefinition): void {
  if (setting.value.kind !== "STRUCTURED") return;
  if (structuredSettingSchema(setting.value.schemaKey) !== undefined) return;
  throw new ManifestError(`${manifest.key}: unknown setting schema ${setting.value.schemaKey}`);
}

function assertSystemDefaultPasses(manifest: ModuleManifest, setting: SettingDefinition): void {
  const parsed = buildSettingValueSchema(setting.value).safeParse(setting.systemDefault);
  if (parsed.success) return;
  throw new ManifestError(`${manifest.key}: systemDefault of ${setting.settingKey} fails its spec`);
}

function assertSettingsAreDeclared(manifests: readonly ModuleManifest[]): void {
  assertSettingKeysAreUnique(manifests);
  for (const manifest of manifests) {
    for (const setting of manifest.settings) {
      assertSettingKeyBelongsToModule(manifest, setting);
      assertStructuredSchemaIsKnown(manifest, setting);
      assertSystemDefaultPasses(manifest, setting);
    }
  }
}

function assertNoDependencyCycle(manifests: readonly ModuleManifest[]): void {
  const byKey = new Map(manifests.map((manifest) => [manifest.key, manifest] as const));
  for (const manifest of manifests) {
    if (findCycle(manifest, byKey))
      throw new ManifestError(`${manifest.key}: dependsOn has a cycle`);
  }
}

/**
 * The rules between manifests (10-MODULE-CATALOG sections 2 and 11). A dependency may name a module
 * that is not registered yet: the resolver drops such a module until the dependency exists.
 */
export function assertRegistryRules(manifests: readonly ModuleManifest[]): void {
  assertKeysAreUnique(manifests);
  for (const manifest of manifests) {
    assertPermissionsBelongToModule(manifest);
    assertPlatformModuleStaysOnPlatform(manifest);
    assertOnlyOptionalModulesCanBeDisabled(manifest);
  }
  assertRoutePrefixesAreUnique(manifests);
  assertNoDependencyCycle(manifests);
  assertSettingsAreDeclared(manifests);
}
