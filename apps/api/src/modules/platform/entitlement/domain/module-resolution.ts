import {
  MODULE_CLASS,
  MODULE_OVERRIDE_EFFECT,
  type ModuleKey,
  type ModuleManifest,
  type ModuleOverrideEffect,
  type OfferingKind,
} from "@banijjik/contracts";
import type { ModuleOverrideRecord } from "./module-override.js";

export interface ModuleResolutionInput {
  /** Every registered manifest. */
  readonly manifests: readonly ModuleManifest[];
  /** The modules of the base package and the add-ons; may name modules without a manifest. */
  readonly packageModuleKeys: readonly ModuleKey[];
  /** Only the overrides that are active now. */
  readonly overrides: readonly ModuleOverrideRecord[];
  readonly allowedModuleKeys: readonly ModuleKey[];
  readonly enabledKinds: readonly OfferingKind[];
}

export interface DroppedModule {
  readonly moduleKey: ModuleKey;
  readonly missingDependency: ModuleKey;
}

export interface ModuleResolution {
  readonly moduleKeys: ReadonlySet<ModuleKey>;
  readonly kinds: readonly OfferingKind[];
  /** For the `config.module.droppedMissingDependency` log line; a paid module is never auto-enabled. */
  readonly droppedForDependency: readonly DroppedModule[];
}

/** PLATFORM modules serve the platform panel only and are never part of the config of an organization. */
function organizationManifests(input: ModuleResolutionInput): readonly ModuleManifest[] {
  return input.manifests.filter((manifest) => manifest.moduleClass !== MODULE_CLASS.PLATFORM);
}

function keysWithEffect(input: ModuleResolutionInput, effect: ModuleOverrideEffect): ModuleKey[] {
  return input.overrides
    .filter((override) => override.effect === effect)
    .map((override) => override.moduleKey);
}

/** Step 1: purchased = packages + PLATFORM_GRANT - PLATFORM_REVOKE - TENANT_DISABLE (where allowed). */
function purchasedModules(input: ModuleResolutionInput): Set<ModuleKey> {
  const purchased = new Set<ModuleKey>([
    ...input.packageModuleKeys,
    ...keysWithEffect(input, MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT),
  ]);
  for (const key of keysWithEffect(input, MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE)) {
    purchased.delete(key);
  }
  const canDisable = new Set(
    input.manifests.filter((manifest) => manifest.tenantCanDisable).map((manifest) => manifest.key),
  );
  for (const key of keysWithEffect(input, MODULE_OVERRIDE_EFFECT.TENANT_DISABLE)) {
    if (canDisable.has(key)) purchased.delete(key);
  }
  return purchased;
}

/** Step 2: SYSTEM + ((CORE + purchased) restricted to what the template allows). */
function candidateModules(
  input: ModuleResolutionInput,
  purchased: ReadonlySet<ModuleKey>,
): Set<ModuleKey> {
  const allowed = new Set(input.allowedModuleKeys);
  const candidates = new Set<ModuleKey>();
  for (const manifest of organizationManifests(input)) {
    const isSystem = manifest.moduleClass === MODULE_CLASS.SYSTEM;
    const isCore = manifest.moduleClass === MODULE_CLASS.CORE;
    const isOffered = (isCore || purchased.has(manifest.key)) && allowed.has(manifest.key);
    if (isSystem || isOffered) candidates.add(manifest.key);
  }
  return candidates;
}

/** Step 3: the kinds of the template that at least one candidate module makes sellable. */
function effectiveKinds(
  input: ModuleResolutionInput,
  candidates: ReadonlySet<ModuleKey>,
): OfferingKind[] {
  const provided = new Set(
    input.manifests
      .filter((manifest) => candidates.has(manifest.key))
      .flatMap((manifest) => manifest.providesKinds),
  );
  return input.enabledKinds.filter((kind) => provided.has(kind));
}

/** Step 4: a module that needs a kind the organization does not have is dropped. */
function dropModulesWithoutKind(
  input: ModuleResolutionInput,
  candidates: ReadonlySet<ModuleKey>,
  kinds: readonly OfferingKind[],
): Set<ModuleKey> {
  const kept = new Set(candidates);
  for (const manifest of input.manifests) {
    if (!kept.has(manifest.key) || manifest.requiresAnyKind.length === 0) continue;
    if (!manifest.requiresAnyKind.some((kind) => kinds.includes(kind))) kept.delete(manifest.key);
  }
  return kept;
}

function findMissingDependency(
  manifest: ModuleManifest,
  kept: ReadonlySet<ModuleKey>,
): ModuleKey | undefined {
  return manifest.dependsOn.find((dependency) => !kept.has(dependency));
}

/** Step 5: repeat until stable; a module whose dependency is not effective is dropped, the dependency is never enabled. */
function dropModulesWithoutDependency(
  input: ModuleResolutionInput,
  afterKinds: ReadonlySet<ModuleKey>,
): { kept: Set<ModuleKey>; dropped: DroppedModule[] } {
  const kept = new Set(afterKinds);
  const dropped: DroppedModule[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const manifest of input.manifests) {
      if (!kept.has(manifest.key)) continue;
      const missing = findMissingDependency(manifest, kept);
      if (missing === undefined) continue;
      kept.delete(manifest.key);
      dropped.push({ moduleKey: manifest.key, missingDependency: missing });
      changed = true;
    }
  }
  return { kept, dropped };
}

/** Steps 1 to 5 of `resolveOrgConfig` (10-MODULE-CATALOG section 3): which modules and kinds are effective. */
export function resolveModules(input: ModuleResolutionInput): ModuleResolution {
  const purchased = purchasedModules(input);
  const candidates = candidateModules(input, purchased);
  const kinds = effectiveKinds(input, candidates);
  const afterKinds = dropModulesWithoutKind(input, candidates, kinds);
  const { kept, dropped } = dropModulesWithoutDependency(input, afterKinds);
  return { moduleKeys: kept, kinds, droppedForDependency: dropped };
}
