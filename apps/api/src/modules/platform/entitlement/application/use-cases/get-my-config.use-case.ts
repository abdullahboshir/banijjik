import {
  isPermissionKey,
  permissionModuleKey,
  type CallerPermissionsResponse,
  type MenuEntry,
  type PermissionDefinition,
  type PermissionDefinitionResponse,
  type PermissionKey,
  type ResolvedOrgConfigResponse,
  type SubscriptionSummaryResponse,
} from "@banijjik/contracts";
import type { CallerGrants, PermissionGate } from "../../../../../kernel/access/index.js";
import type { ResolvedOrgConfig } from "../../domain/resolved-org-config.js";
import type { EffectiveOrgConfig } from "../org-config.service.js";

export interface GetMyConfigDependencies {
  readonly orgConfig: { current(): Promise<EffectiveOrgConfig> };
  readonly permissions: Pick<PermissionGate, "describeCaller">;
  /** Every permission of the registered manifests (the permission catalogue). */
  readonly permissionDefinitions: readonly PermissionDefinition[];
}

/** Permissions of modules that are off have no effect (10-MODULE-CATALOG section 10), so they are left out. */
function restrictToEffectiveModules(
  keys: readonly string[],
  effectiveModules: ReadonlySet<string>,
): PermissionKey[] {
  return keys
    .filter(isPermissionKey)
    .filter((key) => effectiveModules.has(permissionModuleKey(key)));
}

function describePermissions(
  grants: CallerGrants,
  effectiveModules: ReadonlySet<string>,
): CallerPermissionsResponse {
  const byLocation = Object.fromEntries(
    Object.entries(grants.byLocation).map(([locationId, keys]) => [
      locationId,
      restrictToEffectiveModules(keys, effectiveModules),
    ]),
  );
  return {
    allLocations: restrictToEffectiveModules(grants.allLocations, effectiveModules),
    byLocation,
  };
}

function describeDefinitions(
  definitions: readonly PermissionDefinition[],
  effectiveModules: ReadonlySet<string>,
): PermissionDefinitionResponse[] {
  return definitions
    .filter((definition) => effectiveModules.has(permissionModuleKey(definition.permissionKey)))
    .map((definition) => ({
      permissionKey: definition.permissionKey,
      labelKey: definition.labelKey,
      isSensitive: definition.isSensitive,
      moduleKey: permissionModuleKey(definition.permissionKey),
    }));
}

function holdsAnywhere(permissions: CallerPermissionsResponse, key: PermissionKey): boolean {
  if (permissions.allLocations.includes(key)) return true;
  return Object.values(permissions.byLocation).some((keys) => keys.includes(key));
}

function summarizeSubscription(
  config: ResolvedOrgConfig,
  isPastDue: boolean,
): SubscriptionSummaryResponse | null {
  const { subscription } = config;
  if (subscription === undefined) return null;
  return {
    status: subscription.status,
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    isPastDue,
  };
}

/**
 * `GET /orgs/{organizationId}/me/config`: the resolved config for the caller. The menu keeps the
 * entries whose permission the caller holds at some location; the permissions are limited to
 * modules that are effective. Works in READ_ONLY mode because it is a GET.
 */
export class GetMyConfigUseCase {
  constructor(private readonly dependencies: GetMyConfigDependencies) {}

  async execute(): Promise<ResolvedOrgConfigResponse> {
    const effective = await this.dependencies.orgConfig.current();
    const grants = await this.dependencies.permissions.describeCaller();
    const { config } = effective;
    const effectiveModules = new Set<string>(config.modules);
    const permissions = describePermissions(grants, effectiveModules);
    const menu: readonly MenuEntry[] = config.menu.filter((entry) =>
      holdsAnywhere(permissions, entry.permissionKey),
    );
    return {
      organizationId: config.organizationId,
      configVersion: config.configVersion,
      registryHash: config.registryHash,
      accessMode: effective.accessMode,
      isPastDue: effective.isPastDue,
      subscription: summarizeSubscription(config, effective.isPastDue),
      modules: config.modules,
      kinds: config.kinds,
      limits: config.limits,
      menu,
      terms: config.terms,
      settings: config.settings,
      permissions,
      permissionDefinitions: describeDefinitions(
        this.dependencies.permissionDefinitions,
        effectiveModules,
      ),
    };
  }
}
