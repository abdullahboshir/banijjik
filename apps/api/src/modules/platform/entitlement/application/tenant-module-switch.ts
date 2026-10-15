import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  isModuleKey,
  MODULE_OVERRIDE_EFFECT,
  SETTINGS_EVENT_TYPE,
  type ModuleKey,
  type TenantModuleView,
} from "@banijjik/contracts";
import { newId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../../kernel/events/index.js";
import { notFound } from "../../../../kernel/http/index.js";
import type { ModuleRegistry } from "../../../../kernel/modules/index.js";
import type { ConfigVersionBumper } from "../../../../kernel/tenancy/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { PackageReader, PackageView } from "../../package/index.js";
import type { SubscriptionReader, SubscriptionView } from "../../saas-billing/index.js";
import { isOverrideActive, type ModuleOverrideRecord } from "../domain/module-override.js";
import { resolveModules } from "../domain/module-resolution.js";
import { buildTenantModuleCatalogue } from "../domain/tenant-module-catalogue.js";
import { moduleNotTenantDisablable, moduleRequiredBy } from "../domain/tenant-module-errors.js";
import type { ModuleOverrideAdminRepository } from "./ports/override-admin-ports.js";
import type {
  IndustryTemplateReader,
  OrganizationConfigSource,
} from "./ports/entitlement-ports.js";

export interface TenantModuleSwitchDependencies {
  readonly registry: ModuleRegistry;
  readonly clock: Clock;
  readonly templates: IndustryTemplateReader;
  readonly organizations: OrganizationConfigSource;
  readonly subscriptions: SubscriptionReader;
  readonly packages: Pick<PackageReader, "findByIds">;
  readonly overrides: ModuleOverrideAdminRepository;
  readonly audit: AuditRecorder;
  readonly configVersion: ConfigVersionBumper;
}

export interface ModuleSwitchInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly moduleKey: string;
  readonly reason: string;
}

interface LoadedModules {
  readonly views: readonly TenantModuleView[];
  readonly disabledIds: ReadonlyMap<ModuleKey, string>;
}

/** Tenant disable and enable of OPTIONAL modules, written as ModuleOverride rows (ADR-104). */
export class TenantModuleSwitch {
  constructor(private readonly dependencies: TenantModuleSwitchDependencies) {}

  async list(
    organizationId: OrganizationId,
    page: number,
    limit: number,
  ): Promise<{ items: readonly TenantModuleView[]; hasNext: boolean }> {
    const { views } = await this.load(organizationId);
    const start = (page - 1) * limit;
    return { items: views.slice(start, start + limit), hasNext: start + limit < views.length };
  }

  async disable(input: ModuleSwitchInput): Promise<TenantModuleView> {
    const moduleKey = knownKey(input.moduleKey);
    const loaded = await this.load(input.organizationId);
    const row = requireDisablable(loaded, moduleKey);
    if (row.requiredBy.length > 0) throw moduleRequiredBy(moduleKey, row.requiredBy);
    if (row.isDisabledByTenant) return row;
    await new MongoUnitOfWork().run(() => this.insertDisable(input, moduleKey));
    return refreshed(await this.load(input.organizationId), moduleKey, row);
  }

  async enable(input: ModuleSwitchInput): Promise<TenantModuleView> {
    const moduleKey = knownKey(input.moduleKey);
    const loaded = await this.load(input.organizationId);
    const row = loaded.views.find((view) => view.moduleKey === moduleKey);
    const overrideId = loaded.disabledIds.get(moduleKey);
    if (overrideId === undefined) return row ?? refuse(moduleKey);
    await new MongoUnitOfWork().run(() => this.deleteDisable(input, moduleKey, overrideId));
    return refreshed(await this.load(input.organizationId), moduleKey, row);
  }

  private async insertDisable(input: ModuleSwitchInput, moduleKey: ModuleKey): Promise<void> {
    const moduleOverrideId = newId();
    await this.dependencies.overrides.insert(
      {
        moduleOverrideId,
        organizationId: input.organizationId,
        moduleKey,
        effect: MODULE_OVERRIDE_EFFECT.TENANT_DISABLE,
        reason: input.reason,
        expiresAt: null,
        createdAt: this.dependencies.clock.now(),
      },
      input.actorUserId,
    );
    await this.record({ input, moduleKey, moduleOverrideId, isDisabled: true });
  }

  private async deleteDisable(
    input: ModuleSwitchInput,
    moduleKey: ModuleKey,
    moduleOverrideId: string,
  ): Promise<void> {
    await this.dependencies.overrides.delete(input.organizationId, moduleOverrideId);
    await this.record({ input, moduleKey, moduleOverrideId, isDisabled: false });
  }

  private async record(entry: {
    input: ModuleSwitchInput;
    moduleKey: ModuleKey;
    moduleOverrideId: string;
    isDisabled: boolean;
  }): Promise<void> {
    const { input, moduleKey, moduleOverrideId, isDisabled } = entry;
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.MODULE_TOGGLED,
      entityType: AUDIT_ENTITY_TYPE.moduleOverride,
      entityId: moduleOverrideId,
      changes: {
        isDisabled: { from: !isDisabled, to: isDisabled },
        reason: { from: null, to: input.reason },
      },
    });
    await kernelEventPublisher.publish(SETTINGS_EVENT_TYPE.MODULE_TOGGLED, {
      moduleKey,
      isDisabled,
    });
    await this.dependencies.configVersion.bump(input.organizationId);
  }

  private async load(organizationId: string): Promise<LoadedModules> {
    const { organizations, templates, subscriptions, packages, overrides, clock, registry } =
      this.dependencies;
    const snapshot = await organizations.find(organizationId);
    if (snapshot === undefined) throw notFound();
    const template = await templates.find(snapshot.industryTemplateKey);
    const subscription = await subscriptions.findOpen(organizationId);
    const purchased = await loadPackages(packages, subscription);
    const rows = await overrides.list(organizationId);
    const active = rows.filter((row) => isOverrideActive(toRecord(row), clock.now()));
    const resolution = resolveModules({
      manifests: registry.all(),
      packageModuleKeys: purchased,
      overrides: active.map(toRecord),
      allowedModuleKeys: template.allowedModuleKeys,
      enabledKinds: template.enabledKinds,
    });
    const disabledIds = new Map<ModuleKey, string>();
    for (const row of active) {
      if (row.effect === MODULE_OVERRIDE_EFFECT.TENANT_DISABLE)
        disabledIds.set(row.moduleKey, row.moduleOverrideId);
    }
    return {
      views: buildTenantModuleCatalogue({
        manifests: registry.all(),
        allowedModuleKeys: template.allowedModuleKeys,
        packageModuleKeys: purchased,
        effectiveModuleKeys: resolution.moduleKeys,
        disabledModuleKeys: new Set(disabledIds.keys()),
      }),
      disabledIds,
    };
  }
}

function knownKey(moduleKey: string): ModuleKey {
  if (!isModuleKey(moduleKey)) throw moduleNotTenantDisablable(moduleKey);
  return moduleKey;
}

function refuse(moduleKey: ModuleKey): never {
  throw moduleNotTenantDisablable(moduleKey);
}

function requireDisablable(loaded: LoadedModules, moduleKey: ModuleKey): TenantModuleView {
  const row = loaded.views.find((view) => view.moduleKey === moduleKey);
  if (row === undefined || !row.tenantCanDisable) throw moduleNotTenantDisablable(moduleKey);
  return row;
}

function refreshed(
  loaded: LoadedModules,
  moduleKey: ModuleKey,
  previous: TenantModuleView | undefined,
): TenantModuleView {
  return loaded.views.find((view) => view.moduleKey === moduleKey) ?? previous ?? refuse(moduleKey);
}

function toRecord(row: {
  moduleKey: ModuleKey;
  effect: ModuleOverrideRecord["effect"];
  expiresAt: Date | null;
}): ModuleOverrideRecord {
  return { moduleKey: row.moduleKey, effect: row.effect, expiresAt: row.expiresAt };
}

async function loadPackages(
  packages: Pick<PackageReader, "findByIds">,
  subscription: SubscriptionView | undefined,
): Promise<readonly ModuleKey[]> {
  if (subscription === undefined) return [];
  const ids = [subscription.basePackageId, ...subscription.addOnPackageIds];
  const found = await packages.findByIds(ids);
  return found.flatMap((entry: PackageView) => entry.moduleKeys);
}
