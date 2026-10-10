import { createHash } from "node:crypto";
import {
  isPermissionKey,
  PERMISSION_KEY_PATTERN,
  permissionModuleKey,
  SYSTEM_ROLE_KEY,
  type PermissionDefinition,
  type PermissionKey,
  type SystemRoleKey,
} from "@banijjik/contracts";
import { grantedKeysOf, SYSTEM_ROLE_GRANTS } from "../domain/system-role-grants.js";

/** The part of a module manifest the catalogue reads. */
export interface ManifestPermissions {
  readonly key: string;
  readonly permissions: readonly PermissionDefinition[];
}

/** A manifest breaks the permission rules. Thrown at startup so a bad release never serves traffic. */
export class PermissionCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionCatalogError";
  }
}

function assertDefinitionIsValid(manifest: ManifestPermissions, key: string): void {
  if (!isPermissionKey(key)) {
    throw new PermissionCatalogError(`${manifest.key}: unknown permission key ${key}`);
  }
  if (!PERMISSION_KEY_PATTERN.test(key)) {
    throw new PermissionCatalogError(`${manifest.key}: malformed permission key ${key}`);
  }
  if (permissionModuleKey(key) !== manifest.key) {
    throw new PermissionCatalogError(`${manifest.key}: ${key} belongs to another module`);
  }
}

function collectDefinitions(manifests: readonly ManifestPermissions[]): PermissionDefinition[] {
  const seen = new Set<string>();
  const definitions: PermissionDefinition[] = [];
  for (const manifest of manifests) {
    for (const definition of manifest.permissions) {
      assertDefinitionIsValid(manifest, definition.permissionKey);
      if (seen.has(definition.permissionKey)) {
        throw new PermissionCatalogError(`duplicate permission key ${definition.permissionKey}`);
      }
      seen.add(definition.permissionKey);
      definitions.push(definition);
    }
  }
  return definitions;
}

/**
 * Every permission that exists, built at startup from the module manifests (ADR-054). Its hash
 * covers the keys and the system role template, so a release that changes either changes every
 * permission cache key.
 */
export class PermissionCatalog {
  readonly catalogHash: string;
  private readonly definitions: readonly PermissionDefinition[];
  private readonly keySet: ReadonlySet<string>;
  private readonly systemGrants: ReadonlyMap<SystemRoleKey, ReadonlySet<PermissionKey>>;

  constructor(manifests: readonly ManifestPermissions[]) {
    this.definitions = collectDefinitions(manifests);
    const keys = this.definitions.map((definition) => definition.permissionKey);
    this.keySet = new Set(keys);
    this.systemGrants = new Map(
      Object.values(SYSTEM_ROLE_KEY).map((roleKey) => [roleKey, grantedKeysOf(roleKey, keys)]),
    );
    this.catalogHash = createHash("sha256")
      .update(JSON.stringify([[...keys].sort(), SYSTEM_ROLE_GRANTS]))
      .digest("hex");
  }

  all(): readonly PermissionDefinition[] {
    return this.definitions;
  }

  has(permissionKey: string): permissionKey is PermissionKey {
    return this.keySet.has(permissionKey);
  }

  ofModule(moduleKey: string): readonly PermissionDefinition[] {
    return this.definitions.filter(
      (definition) => permissionModuleKey(definition.permissionKey) === moduleKey,
    );
  }

  /** The keys a system role holds right now, from the code template. */
  grantsOf(roleKey: SystemRoleKey): ReadonlySet<PermissionKey> {
    return this.systemGrants.get(roleKey) ?? new Set();
  }
}

export function buildPermissionCatalog(
  manifests: readonly ManifestPermissions[],
): PermissionCatalog {
  return new PermissionCatalog(manifests);
}
