import { MODULE_CLASS, MODULE_OVERRIDE_EFFECT, type ModuleManifest } from "@banijjik/contracts";
import type { ModuleRegistry } from "../../kernel/modules/index.js";
import type { ContractWorld } from "./contract-world.js";
import type { ContractOrganization } from "./contract-types.js";

/** Everything an off-path needs to turn one module off for one organization. */
export interface OffPathContext {
  readonly world: ContractWorld;
  readonly organization: ContractOrganization;
  readonly manifest: ModuleManifest;
}

/** One way a module stops being effective (10-MODULE-CATALOG section 11). */
export interface OffPath {
  readonly name: string;
  /** Why a path does not apply to a class is part of the rule: it is written in the resolver (section 3). */
  isApplicable(manifest: ModuleManifest, registry: ModuleRegistry): boolean;
  apply(context: OffPathContext): Promise<void>;
}

/**
 * Template changes need no version bump: the template version is part of the config cache key.
 * The resolver adds every CORE module to the candidates whatever the package or an override says
 * (section 3, step 2), so only OPTIONAL modules are turned off by package, revoke and disable.
 */
function isOptional(manifest: ModuleManifest): boolean {
  return manifest.moduleClass === MODULE_CLASS.OPTIONAL;
}

/** The first dependency that a scenario can turn off: an OPTIONAL one by revoke, a CORE one by template. */
function findSwitchableDependency(
  manifest: ModuleManifest,
  registry: ModuleRegistry,
): ModuleManifest | undefined {
  return manifest.dependsOn
    .map((key) => registry.find(key))
    .find(
      (dependency) =>
        dependency !== undefined &&
        (dependency.moduleClass === MODULE_CLASS.OPTIONAL ||
          dependency.moduleClass === MODULE_CLASS.CORE),
    );
}

async function turnDependencyOff(context: OffPathContext): Promise<void> {
  const { world, organization, manifest } = context;
  const dependency = findSwitchableDependency(manifest, world.registry);
  if (dependency === undefined) throw new Error(`${manifest.key} has no switchable dependency`);
  if (dependency.moduleClass === MODULE_CLASS.CORE) {
    world.templateReader.excludeModule(dependency.key);
    return;
  }
  await world.override(
    organization.organizationId,
    dependency.key,
    MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
  );
}

export const OFF_PATHS: readonly OffPath[] = [
  {
    name: "not in the package",
    isApplicable: isOptional,
    apply: ({ world, organization, manifest }) =>
      world.removeFromPackage(organization.organizationId, manifest.key),
  },
  {
    name: "PLATFORM_REVOKE",
    isApplicable: isOptional,
    apply: ({ world, organization, manifest }) =>
      world.override(
        organization.organizationId,
        manifest.key,
        MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
      ),
  },
  {
    name: "TENANT_DISABLE",
    isApplicable: (manifest) => manifest.tenantCanDisable,
    apply: ({ world, organization, manifest }) =>
      world.override(
        organization.organizationId,
        manifest.key,
        MODULE_OVERRIDE_EFFECT.TENANT_DISABLE,
      ),
  },
  {
    name: "the template excludes it",
    isApplicable: () => true,
    apply: async ({ world, manifest }) => world.templateReader.excludeModule(manifest.key),
  },
  {
    name: "a required kind is missing",
    isApplicable: (manifest) => manifest.requiresAnyKind.length > 0,
    apply: async ({ world, manifest }) =>
      world.templateReader.excludeKinds(manifest.requiresAnyKind),
  },
  {
    name: "a dependency is missing",
    isApplicable: (manifest, registry) =>
      findSwitchableDependency(manifest, registry) !== undefined,
    apply: turnDependencyOff,
  },
];

/** The off-paths that apply to a module, in a fixed order. */
export function applicableOffPaths(
  manifest: ModuleManifest,
  registry: ModuleRegistry,
): readonly OffPath[] {
  return OFF_PATHS.filter((path) => path.isApplicable(manifest, registry));
}
