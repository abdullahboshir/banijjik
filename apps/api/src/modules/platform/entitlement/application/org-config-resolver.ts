import type { IndustryTemplateKey, ModuleKey } from "@banijjik/contracts";
import { getLogger } from "../../../../kernel/logger/index.js";
import type { ModuleRegistry } from "../../../../kernel/modules/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { PackageReader, PackageView } from "../../package/index.js";
import type { SubscriptionReader, SubscriptionView } from "../../saas-billing/index.js";
import { botToolsOf, menuOf, storefrontSectionsOf } from "../domain/config-sections.js";
import { combineLimits } from "../domain/limits.js";
import { resolveModules } from "../domain/module-resolution.js";
import {
  earliestExpiry,
  isOverrideActive,
  type ModuleOverrideRecord,
} from "../domain/module-override.js";
import type { ResolvedOrgConfig, SubscriptionSnapshot } from "../domain/resolved-org-config.js";
import type { IndustryTemplateView, ModuleOverrideReader } from "./ports/entitlement-ports.js";
import type {
  OrgClientSettingsSource,
  OrgFieldsSource,
  OrgTermsSource,
} from "./ports/resolved-config-sources.js";

export interface OrgConfigResolverDependencies {
  readonly registry: ModuleRegistry;
  readonly subscriptions: SubscriptionReader;
  readonly packages: Pick<PackageReader, "findByIds">;
  readonly overrides: ModuleOverrideReader;
  readonly clock: Clock;
  readonly terms: OrgTermsSource;
  readonly clientSettings: OrgClientSettingsSource;
  readonly fields: OrgFieldsSource;
}

export interface ResolveRequest {
  readonly organizationId: string;
  readonly configVersion: number;
  readonly templateKey: IndustryTemplateKey;
  readonly template: IndustryTemplateView;
}

interface ResolvedParts {
  readonly subscription: SubscriptionView | undefined;
  readonly purchased: PurchasedPackages;
  readonly moduleKeys: ReadonlySet<ModuleKey>;
  readonly kinds: ResolvedOrgConfig["kinds"];
  readonly overrides: readonly ModuleOverrideRecord[];
}

interface PurchasedPackages {
  readonly base: PackageView | undefined;
  readonly addOns: readonly PackageView[];
}

function packageModuleKeys(purchased: PurchasedPackages): readonly ModuleKey[] {
  return [purchased.base, ...purchased.addOns].flatMap((entry) => entry?.moduleKeys ?? []);
}

function toSubscriptionSnapshot(
  subscription: SubscriptionView | undefined,
): SubscriptionSnapshot | undefined {
  if (subscription === undefined) return undefined;
  const { status, trialEndsAt, currentPeriodEnd } = subscription;
  return { status, trialEndsAt, currentPeriodEnd };
}

/**
 * `resolveOrgConfig` of 10-MODULE-CATALOG section 3: reads the subscription, its packages and the
 * overrides, then applies steps 1 to 8. Step 5 logs a dropped module and never enables a paid one.
 */
export class OrgConfigResolver {
  constructor(private readonly dependencies: OrgConfigResolverDependencies) {}

  async resolve(request: ResolveRequest): Promise<ResolvedOrgConfig> {
    const { registry, subscriptions, overrides, clock } = this.dependencies;
    const subscription = await subscriptions.findOpen(request.organizationId);
    const purchased = await this.loadPackages(subscription);
    const allOverrides = await overrides.findAll(request.organizationId);
    const activeOverrides = allOverrides.filter((entry) => isOverrideActive(entry, clock.now()));
    const resolution = resolveModules({
      manifests: registry.all(),
      packageModuleKeys: packageModuleKeys(purchased),
      overrides: activeOverrides,
      allowedModuleKeys: request.template.allowedModuleKeys,
      enabledKinds: request.template.enabledKinds,
    });
    this.logDropped(request.organizationId, resolution.droppedForDependency);
    return this.assemble(request, {
      subscription,
      purchased,
      moduleKeys: resolution.moduleKeys,
      kinds: resolution.kinds,
      overrides: activeOverrides,
    });
  }

  private async loadPackages(
    subscription: SubscriptionView | undefined,
  ): Promise<PurchasedPackages> {
    if (subscription === undefined) return { base: undefined, addOns: [] };
    const ids = [subscription.basePackageId, ...subscription.addOnPackageIds];
    const found = await this.dependencies.packages.findByIds(ids);
    return {
      base: found.find((entry) => entry.packageId === subscription.basePackageId),
      addOns: found.filter((entry) => entry.packageId !== subscription.basePackageId),
    };
  }

  private logDropped(
    organizationId: string,
    dropped: readonly { moduleKey: ModuleKey; missingDependency: ModuleKey }[],
  ): void {
    for (const entry of dropped) {
      getLogger().warn(
        { event: "config.module.droppedMissingDependency", organizationId, ...entry },
        "module dropped because a dependency is not effective",
      );
    }
  }

  private async assemble(
    request: ResolveRequest,
    resolved: ResolvedParts,
  ): Promise<ResolvedOrgConfig> {
    const { registry, terms, clientSettings, fields } = this.dependencies;
    const manifests = registry.all();
    const { moduleKeys, kinds, purchased } = resolved;
    const [resolvedTerms, settings, resolvedFields] = await Promise.all([
      terms.forOrganization(request.organizationId, request.templateKey),
      clientSettings.resolve(request.organizationId, moduleKeys),
      fields.forModules(request.organizationId, moduleKeys),
    ]);
    return {
      organizationId: request.organizationId,
      configVersion: request.configVersion,
      registryHash: registry.registryHash,
      modules: [...moduleKeys].sort(),
      kinds,
      limits: combineLimits(purchased.base, purchased.addOns),
      menu: menuOf(manifests, moduleKeys, kinds),
      botTools: botToolsOf(manifests, moduleKeys),
      storefrontSections: storefrontSectionsOf(manifests, moduleKeys),
      settings,
      fields: resolvedFields,
      contactRoleKeys: request.template.contactRoleKeys,
      resourceTypes: request.template.resourceTypes ?? [],
      terms: resolvedTerms,
      subscription: toSubscriptionSnapshot(resolved.subscription),
      validUntil: earliestExpiry(resolved.overrides),
    };
  }
}
