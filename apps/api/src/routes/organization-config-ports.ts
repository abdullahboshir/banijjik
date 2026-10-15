import type { ModuleRegistry } from "../kernel/modules/index.js";
import { buildModuleFieldsReader } from "../modules/core/custom-field/index.js";
import {
  buildActiveLocationCounter,
  buildOrganizationConfigSource,
} from "../modules/core/organization/index.js";
import {
  buildClientSettingsSource,
  buildResolvedTermTexts,
} from "../modules/core/settings/index.js";
import type {
  ActiveLocationCounter,
  OrgClientSettingsSource,
  OrgFieldsSource,
  OrgTermsSource,
  OrganizationConfigSource,
} from "../modules/platform/entitlement/index.js";
import { runInOrganizationContext } from "../kernel/tenancy/index.js";

export interface OrganizationConfigPorts {
  readonly organizations: OrganizationConfigSource;
  readonly activeLocations: ActiveLocationCounter;
}

export interface ResolvedConfigSources {
  readonly terms: OrgTermsSource;
  readonly clientSettings: OrgClientSettingsSource;
  readonly fields: OrgFieldsSource;
}

/**
 * The three reads `resolveOrgConfig` adds. Each receives the effective module set from the
 * resolver and must not call back through OrgConfigReader (ADR-104).
 */
export function buildResolvedConfigSources(registry: ModuleRegistry): ResolvedConfigSources {
  return {
    terms: buildResolvedTermTexts(),
    clientSettings: buildClientSettingsSource(registry.all()),
    fields: buildModuleFieldsReader(registry),
  };
}

/**
 * What the entitlement config service reads from core/organization. Locations are tenant data, so
 * their count runs in the organization's context; only the composition root may establish one (ADR-087).
 */
export function buildOrganizationConfigPorts(): OrganizationConfigPorts {
  const counter = buildActiveLocationCounter();
  return {
    organizations: buildOrganizationConfigSource(),
    activeLocations: {
      countActive: (organizationId) =>
        runInOrganizationContext(organizationId, () => counter.countActive()),
    },
  };
}
