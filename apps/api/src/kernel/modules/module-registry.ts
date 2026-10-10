import { createHash } from "node:crypto";
import type { ModuleKey, ModuleManifest } from "@banijjik/contracts";
import { canonicalJson } from "./canonical-json.js";
import { assertRegistryRules } from "./registry-rules.js";
import { allRoutePrefixes, findOwningRoute, type RoutePrefix } from "./route-prefix.js";

/**
 * Every module of the running application, validated once at startup (ADR-091). The permission
 * catalogue, the entitlement gate, the menu and the resolver are all built from it.
 */
export class ModuleRegistry {
  /** Hash of all manifests; part of the config cache key, so a deploy that changes one drops every cached config. */
  readonly registryHash: string;
  private readonly manifests: readonly ModuleManifest[];
  private readonly byKey: ReadonlyMap<ModuleKey, ModuleManifest>;
  private readonly routePrefixes: readonly RoutePrefix[];

  constructor(manifests: readonly ModuleManifest[]) {
    assertRegistryRules(manifests);
    this.manifests = [...manifests].sort((left, right) => left.key.localeCompare(right.key, "en"));
    this.byKey = new Map(this.manifests.map((manifest) => [manifest.key, manifest] as const));
    this.routePrefixes = this.manifests.flatMap(allRoutePrefixes);
    this.registryHash = createHash("sha256").update(canonicalJson(this.manifests)).digest("hex");
  }

  all(): readonly ModuleManifest[] {
    return this.manifests;
  }

  find(key: ModuleKey): ModuleManifest | undefined {
    return this.byKey.get(key);
  }

  /** The module that owns a request path: the longest matching route prefix wins. */
  ownerOfRoute(path: string): ModuleManifest | undefined {
    return findOwningRoute(this.routePrefixes, path)?.owner;
  }
}

export function createModuleRegistry(manifests: readonly ModuleManifest[]): ModuleRegistry {
  return new ModuleRegistry(manifests);
}
