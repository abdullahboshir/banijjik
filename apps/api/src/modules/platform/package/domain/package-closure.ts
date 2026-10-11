import { MODULE_CLASS, type ModuleKey, type ModuleManifest } from "@banijjik/contracts";
import type { ClosureGap } from "./errors.js";

/**
 * The platform invariant on save (10-MODULE-CATALOG section 3): the modules of a base package,
 * plus SYSTEM and CORE, must be closed under `dependsOn` over the registered manifests. A package
 * that would ship a module without its dependency cannot be saved. A module without a manifest
 * has no `dependsOn` to check yet, and a dependency without a manifest is skipped, because it
 * cannot be offered before its card is built (the resolver drops such modules the same way).
 */
export function findClosureGaps(
  moduleKeys: readonly ModuleKey[],
  manifests: readonly ModuleManifest[],
): ClosureGap[] {
  const registered = new Set(manifests.map((manifest) => manifest.key));
  const provided = new Set<ModuleKey>(moduleKeys);
  for (const manifest of manifests) {
    const isAlwaysOn =
      manifest.moduleClass === MODULE_CLASS.SYSTEM || manifest.moduleClass === MODULE_CLASS.CORE;
    if (isAlwaysOn) provided.add(manifest.key);
  }
  return manifests
    .filter((manifest) => moduleKeys.includes(manifest.key))
    .flatMap((manifest) =>
      manifest.dependsOn
        .filter((dependency) => registered.has(dependency) && !provided.has(dependency))
        .map((missingDependency) => ({ moduleKey: manifest.key, missingDependency })),
    );
}

/** The module keys of a package that have no registered manifest yet; the closure rule skips them. */
export function findUnbuiltModuleKeys(
  moduleKeys: readonly ModuleKey[],
  manifests: readonly ModuleManifest[],
): ModuleKey[] {
  const registered = new Set(manifests.map((manifest) => manifest.key));
  return moduleKeys.filter((moduleKey) => !registered.has(moduleKey));
}
