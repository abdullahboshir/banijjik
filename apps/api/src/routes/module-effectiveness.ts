import type { ModuleEffectiveness } from "../kernel/events/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "./organization-config-ports.js";
import { buildIndustryTemplateReader } from "../modules/platform/industry/index.js";
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
  const registry = buildModuleRegistry();
  const service = buildOrgConfigService({
    registry,
    clock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: buildIndustryTemplateReader(clock),
  });
  return buildModuleEffectiveness(service);
}
