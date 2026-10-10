import type { ModuleEffectiveness } from "../kernel/events/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildOrganizationConfigSource } from "../modules/core/organization/index.js";
import {
  buildModuleEffectiveness,
  buildOrgConfigService,
} from "../modules/platform/entitlement/index.js";
import { buildModuleRegistry } from "./module-registry.js";

/**
 * The check the worker role runs before every event handler: is the handler module on for the
 * organization of the event (10-MODULE-CATALOG section 2)? Built here, like the gate of the API.
 */
export function buildEventModuleEffectiveness(clock: Clock): ModuleEffectiveness {
  const service = buildOrgConfigService({
    registry: buildModuleRegistry(),
    clock,
    organizations: buildOrganizationConfigSource(),
  });
  return buildModuleEffectiveness(service);
}
