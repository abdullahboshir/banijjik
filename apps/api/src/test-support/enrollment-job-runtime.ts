import type { ScheduledJob } from "../kernel/jobs/index.js";
import { buildModuleRegistry } from "../routes/module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../routes/organization-config-ports.js";
import { buildOrgConfigService } from "../modules/platform/entitlement/index.js";
import { buildIndustryTemplateReader } from "../modules/platform/industry/index.js";
import { buildEnrollmentWorkerJobs } from "../routes/enrollment-worker-jobs.js";
export function enrollmentJobsAt(date: string): { jobs: readonly ScheduledJob[]; now: Date } {
  const now = new Date(date);
  const clock = { now: () => now };
  const registry = buildModuleRegistry();
  const orgConfig = buildOrgConfigService({
    registry,
    clock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: buildIndustryTemplateReader(clock),
  });
  return { jobs: buildEnrollmentWorkerJobs({ clock, registry, orgConfig }), now };
}
