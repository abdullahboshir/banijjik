import {
  EVENT_TYPE,
  isModuleKey,
  isPermissionKey,
  MODULE_CLASS,
  ME_CONFIG_PATH,
  permissionModuleKey,
  SURFACE,
  type ModuleKey,
  type ModuleManifest,
} from "@banijjik/contracts";
import type { Router } from "express";
import { describe, expect, it } from "vitest";
import { createModuleRegistry } from "../../kernel/modules/index.js";
import { listTenantRoutes } from "./mounted-routes.js";

export interface SeedBasePackage {
  readonly packageKey: string;
  readonly moduleKeys: readonly string[];
}

export interface RegistryContractOptions {
  /** The production manifests, the same list routes/v1.ts builds its registry from. */
  readonly manifests: readonly ModuleManifest[];
  /** The base (not add-on) packages of the seed data. */
  readonly basePackages: readonly SeedBasePackage[];
  /** The router `buildV1Router` returns for production, with no probe routers. */
  readonly v1Router: () => Router;
}

function duplicatesOf(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

/** Depth-first search over `dependsOn`; a key reached again on the way down is a cycle. */
function findCycle(manifests: readonly ModuleManifest[]): ModuleKey[] | undefined {
  const byKey = new Map(manifests.map((manifest) => [manifest.key, manifest] as const));
  const visit = (key: ModuleKey, trail: readonly ModuleKey[]): ModuleKey[] | undefined => {
    if (trail.includes(key)) return [...trail, key];
    for (const dependency of byKey.get(key)?.dependsOn ?? []) {
      const cycle = visit(dependency, [...trail, key]);
      if (cycle !== undefined) return cycle;
    }
    return undefined;
  };
  for (const manifest of manifests) {
    const cycle = visit(manifest.key, []);
    if (cycle !== undefined) return cycle;
  }
  return undefined;
}

function describeKeyRules(manifests: readonly ModuleManifest[]): void {
  it("uses only module keys that are declared in contracts", () => {
    expect(manifests.filter((manifest) => !isModuleKey(manifest.key))).toEqual([]);
  });

  it("has no dependsOn cycle", () => {
    expect(findCycle(manifests)).toBeUndefined();
  });

  it("builds a module registry, which checks key, route and tenantCanDisable rules too", () => {
    expect(() => createModuleRegistry(manifests)).not.toThrow();
  });

  it("declares each permission key in contracts, under its own module, once in the application", () => {
    const keys = manifests.flatMap((manifest) => manifest.permissions);
    const foreign = manifests.flatMap((manifest) =>
      manifest.permissions
        .filter(
          ({ permissionKey }) =>
            !isPermissionKey(permissionKey) || permissionModuleKey(permissionKey) !== manifest.key,
        )
        .map(({ permissionKey }) => permissionKey),
    );
    expect(foreign).toEqual([]);
    expect(duplicatesOf(keys.map(({ permissionKey }) => permissionKey))).toEqual([]);
  });

  it("declares each emitted and consumed event in contracts, and each event type has one emitter", () => {
    const known = new Set<string>(Object.values(EVENT_TYPE));
    const used = manifests.flatMap((manifest) => [
      ...manifest.events.emits,
      ...manifest.events.consumes,
    ]);
    expect(used.filter((type) => !known.has(type))).toEqual([]);
    expect(duplicatesOf(manifests.flatMap((manifest) => manifest.events.emits))).toEqual([]);
  });

  // Contracts has no registry for these yet (setting keys arrive with card 2.4, bot tools and sections later),
  // so the rule that holds today is uniqueness. Add the "declared in contracts" check with those registries.
  it("keeps setting, custom field, bot tool, storefront section and menu keys unique", () => {
    const lists = [
      manifests.flatMap((manifest) => manifest.settingKeys),
      manifests.flatMap((manifest) => manifest.customFieldEntities),
      manifests.flatMap((manifest) => manifest.botTools),
      manifests.flatMap((manifest) => manifest.storefrontSections),
      manifests.flatMap((manifest) => manifest.menu.map((entry) => entry.menuKey)),
    ];
    expect(lists.flatMap(duplicatesOf)).toEqual([]);
  });
}

function describePlatformRules(manifests: readonly ModuleManifest[]): void {
  it("lets a PLATFORM module declare platform routes and menu entries only", () => {
    const offenders = manifests
      .filter((manifest) => manifest.moduleClass === MODULE_CLASS.PLATFORM)
      .filter((manifest) => {
        const { admin, storefront, webhook } = manifest.routes;
        const hasTenantRoute = [admin, storefront, webhook].some((list) => (list ?? []).length > 0);
        return hasTenantRoute || manifest.menu.some((entry) => entry.surface !== SURFACE.PLATFORM);
      })
      .map((manifest) => manifest.key);
    expect(offenders).toEqual([]);
  });
}

function describePackageRules(options: RegistryContractOptions): void {
  const { manifests, basePackages } = options;
  const registered = new Set(manifests.map((manifest) => manifest.key));
  const coreKeys = manifests
    .filter((manifest) => manifest.moduleClass === MODULE_CLASS.CORE)
    .map((manifest) => manifest.key);
  const packageKeys = new Set(basePackages.flatMap((entry) => entry.moduleKeys));
  const withoutManifest = [...packageKeys].filter((key) => !registered.has(key as ModuleKey));

  it(`puts all ${coreKeys.length} CORE modules that have a manifest into every seed base package`, () => {
    const missing = basePackages.flatMap((entry) =>
      coreKeys
        .filter((key) => !entry.moduleKeys.includes(key))
        .map((key) => `${entry.packageKey} lacks ${key}`),
    );
    expect(missing).toEqual([]);
  });

  it("closes every seed base package under dependsOn over the registered manifests", () => {
    const systemKeys = manifests
      .filter((manifest) => manifest.moduleClass === MODULE_CLASS.SYSTEM)
      .map((manifest) => manifest.key as string);
    const gaps = basePackages.flatMap((entry) =>
      manifests
        .filter((manifest) => entry.moduleKeys.includes(manifest.key))
        .flatMap((manifest) => manifest.dependsOn.map((dependency) => ({ manifest, dependency })))
        .filter(({ dependency }) => registered.has(dependency))
        .filter(({ dependency }) => ![...entry.moduleKeys, ...systemKeys].includes(dependency))
        .map(
          ({ manifest, dependency }) => `${entry.packageKey}: ${manifest.key} needs ${dependency}`,
        ),
    );
    expect(gaps).toEqual([]);
  });

  // Visible on purpose: the closure rule skips these keys until their manifests exist.
  it(`skips ${withoutManifest.length} seed package keys that have no manifest yet: ${withoutManifest.join(", ")}`, () => {
    expect(withoutManifest.every((key) => isModuleKey(key))).toBe(true);
  });
}

function describeRouteOwnership(options: RegistryContractOptions): void {
  it("owns every tenant router mounted in routes/v1.ts through a manifest route", () => {
    const registry = createModuleRegistry(options.manifests);
    const { paths, unreadableMounts } = listTenantRoutes(options.v1Router());

    const unowned = paths.filter(
      (path) => path !== ME_CONFIG_PATH && registry.ownerOfRoute(path) === undefined,
    );

    expect(paths.length, "the walk found the mounted tenant routes").toBeGreaterThan(0);
    expect(unreadableMounts, "nested routers with a mount path cannot be read").toBe(0);
    expect(unowned).toEqual([]);
  });
}

/** The registry-wide tests of 10-MODULE-CATALOG section 11, second list, over the production manifests. */
export function describeRegistryContracts(options: RegistryContractOptions): void {
  describe("registry contracts over the production manifests", () => {
    describeKeyRules(options.manifests);
    describePlatformRules(options.manifests);
    describePackageRules(options);
    describeRouteOwnership(options);
  });
}
