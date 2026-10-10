import {
  buildActiveLocationCounter,
  buildOrganizationConfigSource,
} from "../modules/core/organization/index.js";
import type {
  ActiveLocationCounter,
  OrganizationConfigSource,
} from "../modules/platform/entitlement/index.js";
import { runInOrganizationContext } from "../kernel/tenancy/index.js";

export interface OrganizationConfigPorts {
  readonly organizations: OrganizationConfigSource;
  readonly activeLocations: ActiveLocationCounter;
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
