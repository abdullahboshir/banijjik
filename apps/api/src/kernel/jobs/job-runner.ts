import type { ModuleKey } from "@banijjik/contracts";
import { SYSTEM_REASON } from "@banijjik/contracts";
import { getLogger } from "../logger/index.js";
import { runAsSystem, runWithRequestContext } from "../context/index.js";
import { runInOrganizationContext } from "../tenancy/index.js";
import type { ModuleEffectiveness } from "../events/module-effectiveness.js";
import type { Clock } from "../time/index.js";
import type { ScheduledJob } from "./job-registry.js";
import { listActiveOrganizationIds } from "./organization-targets.js";

export interface JobRunnerDependencies {
  readonly effectiveness: ModuleEffectiveness;
  readonly clock: Clock;
}

interface OrganizationRunInput {
  readonly job: ScheduledJob;
  readonly organizationId: string;
  readonly now: Date;
  readonly dependencies: JobRunnerDependencies;
}

/**
 * Runs one scheduled job across every ACTIVE organization whose module (if any) is effective.
 * Failures in one organization are reported and do not stop the others.
 */
export async function runScheduledJob(
  job: ScheduledJob,
  dependencies: JobRunnerDependencies,
): Promise<void> {
  const now = dependencies.clock.now();
  const organizationIds = await listActiveOrganizationIds();
  for (const organizationId of organizationIds) {
    await runForOrganization({ job, organizationId, now, dependencies });
  }
}

async function runForOrganization(input: OrganizationRunInput): Promise<void> {
  const { job, organizationId, now, dependencies } = input;
  try {
    if (!(await shouldRunForOrganization(job, organizationId, dependencies))) return;
    await runWithRequestContext({ requestId: `job:${job.jobKey}:${organizationId}` }, () =>
      runInOrganizationContext(organizationId, () => job.run(organizationId, now)),
    );
  } catch (error) {
    getLogger().error(
      {
        event: "jobs.organization_failed",
        jobKey: job.jobKey,
        organizationId,
        err: error,
      },
      "scheduled job failed for one organization",
    );
  }
}

async function shouldRunForOrganization(
  job: ScheduledJob,
  organizationId: string,
  dependencies: JobRunnerDependencies,
): Promise<boolean> {
  const moduleKey = job.moduleKey;
  if (moduleKey === undefined) return true;
  return isModuleEffective(dependencies.effectiveness, organizationId, moduleKey);
}

async function isModuleEffective(
  effectiveness: ModuleEffectiveness,
  organizationId: string,
  moduleKey: ModuleKey,
): Promise<boolean> {
  return runAsSystem(SYSTEM_REASON.SCHEDULED_JOB, () =>
    effectiveness.isEffective(organizationId, moduleKey),
  );
}
