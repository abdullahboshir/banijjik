import type { ModuleKey } from "@banijjik/contracts";

/**
 * Port implemented by platform/entitlement: "is this module effective for this organization?".
 * The handler runner asks it before a handler runs, so a module that is off for an organization
 * consumes none of its events (10-MODULE-CATALOG section 2, ADR-049). Called inside the event's
 * organization context.
 */
export interface ModuleEffectiveness {
  isEffective(organizationId: string, moduleKey: ModuleKey): Promise<boolean>;
}
