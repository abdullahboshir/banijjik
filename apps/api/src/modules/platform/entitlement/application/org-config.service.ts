import {
  ERROR_CODE,
  MODULE_CLASS,
  type IndustryTemplateKey,
  type ModuleKey,
} from "@banijjik/contracts";
import { InMemoryLruCache } from "../../../../kernel/cache/index.js";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { AppError, notFound } from "../../../../kernel/http/index.js";
import type { OrgConfigReader } from "../../../../kernel/access/index.js";
import type { ModuleRegistry } from "../../../../kernel/modules/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import { accessModeOf, type AccessState } from "../../saas-billing/index.js";
import { applyMenuVisibility, needsLocationCount } from "../domain/config-sections.js";
import type { ResolvedOrgConfig } from "../domain/resolved-org-config.js";
import type { OrgConfigResolver } from "./org-config-resolver.js";
import type { PackageCatalogVersion } from "./package-catalog-version.js";
import type {
  ActiveLocationCounter,
  IndustryTemplateReader,
  OrganizationConfigSource,
} from "./ports/entitlement-ports.js";

/** The cached config plus the access mode computed from the subscription dates right now. */
export interface EffectiveOrgConfig extends AccessState {
  readonly config: ResolvedOrgConfig;
  readonly modules: readonly ModuleKey[];
}

export interface OrgConfigServiceDependencies {
  readonly registry: ModuleRegistry;
  readonly resolver: OrgConfigResolver;
  readonly organizations: OrganizationConfigSource;
  /** Decides the menu entries that need two or more locations; the count is part of the cached config. */
  readonly activeLocations: ActiveLocationCounter;
  readonly templates: IndustryTemplateReader;
  readonly catalogVersion: PackageCatalogVersion;
  readonly configCache: InMemoryLruCache<ResolvedOrgConfig>;
  /** Remembers the template key of an organization per config version, so the hot path does not read the organization. */
  readonly templateKeyCache: InMemoryLruCache<IndustryTemplateKey>;
  readonly clock: Clock;
}

function internalMissingContext(): AppError {
  return new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.missing_tenant_context" });
}

/**
 * Hands out the resolved config of an organization, from a cache whose key holds every version
 * that could make it stale (ADR-091): `configVersion` (read fresh by tenantContext on every
 * request), the registry hash, the package catalogue version and the template version.
 */
export class OrgConfigService implements OrgConfigReader {
  constructor(private readonly dependencies: OrgConfigServiceDependencies) {}

  /** The config of the organization of the current request. */
  async current(): Promise<EffectiveOrgConfig> {
    const { organizationId, configVersion } = getRequestContext();
    if (organizationId === undefined || configVersion === undefined) {
      throw internalMissingContext();
    }
    return this.effective(organizationId, configVersion);
  }

  /** For code that runs without a request, such as event handlers: reads the config version first. */
  async forOrganization(organizationId: string): Promise<EffectiveOrgConfig> {
    const snapshot = await this.dependencies.organizations.find(organizationId);
    if (snapshot === undefined) throw notFound();
    this.dependencies.templateKeyCache.set(
      templateKeyCacheKey(organizationId, snapshot.configVersion),
      snapshot.industryTemplateKey,
    );
    return this.effective(organizationId, snapshot.configVersion);
  }

  /** SYSTEM modules are always effective, so they need no resolution. */
  async isModuleEffective(organizationId: string, moduleKey: ModuleKey): Promise<boolean> {
    const manifest = this.dependencies.registry.find(moduleKey);
    if (manifest === undefined) return false;
    if (manifest.moduleClass === MODULE_CLASS.SYSTEM) return true;
    return (await this.forOrganization(organizationId)).modules.includes(moduleKey);
  }

  private async effective(
    organizationId: string,
    configVersion: number,
  ): Promise<EffectiveOrgConfig> {
    const config = await this.resolveCached(organizationId, configVersion);
    const state = accessModeOf(config.subscription, this.dependencies.clock.now());
    return { ...state, config, modules: config.modules };
  }

  private async resolveCached(
    organizationId: string,
    configVersion: number,
  ): Promise<ResolvedOrgConfig> {
    const { registry, templates, catalogVersion, configCache, resolver, clock } = this.dependencies;
    const templateKey = await this.templateKeyOf(organizationId, configVersion);
    const template = await templates.find(templateKey);
    const packageCatalogVersion = await catalogVersion.current();
    const cacheKey = [
      `org:${organizationId}:config:${configVersion}`,
      registry.registryHash,
      packageCatalogVersion,
      template.templateVersion,
    ].join(":");
    const cached = configCache.get(cacheKey);
    // An expired override changes the module set without any version bump, so the copy carries its own deadline.
    if (cached !== undefined && !isPastDeadline(cached, clock.now())) return cached;
    const unfiltered = await resolver.resolve({ organizationId, configVersion, template });
    const resolved = await this.withVisibleMenu(unfiltered);
    configCache.set(cacheKey, resolved);
    return resolved;
  }

  /**
   * Location create and archive bump `configVersion`, which is part of the cache key, so the count
   * read here stays right for as long as this copy lives.
   */
  private async withVisibleMenu(config: ResolvedOrgConfig): Promise<ResolvedOrgConfig> {
    if (!needsLocationCount(config.menu)) return config;
    const count = await this.dependencies.activeLocations.countActive(config.organizationId);
    return { ...config, menu: applyMenuVisibility(config.menu, count) };
  }

  private async templateKeyOf(
    organizationId: string,
    configVersion: number,
  ): Promise<IndustryTemplateKey> {
    const { templateKeyCache, organizations } = this.dependencies;
    const cacheKey = templateKeyCacheKey(organizationId, configVersion);
    const cached = templateKeyCache.get(cacheKey);
    if (cached !== undefined) return cached;
    const snapshot = await organizations.find(organizationId);
    if (snapshot === undefined) throw notFound();
    templateKeyCache.set(cacheKey, snapshot.industryTemplateKey);
    return snapshot.industryTemplateKey;
  }
}

function templateKeyCacheKey(organizationId: string, configVersion: number): string {
  return `org:${organizationId}:template:${configVersion}`;
}

function isPastDeadline(config: ResolvedOrgConfig, now: Date): boolean {
  return config.validUntil !== null && now.getTime() >= config.validUntil.getTime();
}
