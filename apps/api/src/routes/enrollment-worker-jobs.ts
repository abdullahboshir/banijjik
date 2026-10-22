import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { ENROLLMENT_RULE_KEY } from "@banijjik/contracts/enrollment";
import { buildEnrollmentJobs } from "../modules/commerce/enrollment/index.js";
import { registerScheduledJob, type ScheduledJob } from "../kernel/jobs/index.js";
import { getRequestContext, runWithRequestContext } from "../kernel/context/index.js";
import { createIdempotencyMiddleware } from "../kernel/idempotency/index.js";
import { buildAuditRecorder } from "../modules/core/audit/index.js";
import {
  buildLocationLookup,
  buildOrganizationConfigSource,
} from "../modules/core/organization/index.js";
import { buildAccessParts } from "./v1.js";
import { buildEnrollmentRuntime } from "./enrollment-tenant-router.js";
import type { Clock } from "../kernel/time/index.js";
import type { ModuleRegistry } from "../kernel/modules/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";

type WorkerInput = { clock: Clock; registry: ModuleRegistry; orgConfig: OrgConfigService };
/** Jobs already run in a validated organization context; they reach that organization's active locations. */
export function buildEnrollmentWorkerJobs(input: WorkerInput): readonly ScheduledJob[] {
  const access = buildAccessParts({
    clock: input.clock,
    registry: input.registry,
    redis: undefined,
  });
  const runtime = buildEnrollmentRuntime({
    ...input,
    manifests: input.registry.all(),
    audit: buildAuditRecorder(input.clock),
    permission: access.permission,
    idempotency: createIdempotencyMiddleware({ clock: input.clock }),
    permissions: { locationsWith: async () => "ALL" },
  });
  const fee = runtime.context.fee;
  const locations = buildLocationLookup();
  runtime.context.fee = async (organizationId, body) => {
    if (!(await locations.isActiveLocation(body.locationId)))
      throw new DomainRuleError({
        code: ERROR_CODE.VALIDATION_ERROR,
        messageKey: ENROLLMENT_RULE_KEY.PLAN,
      });
    return fee(organizationId, body);
  };
  return buildEnrollmentJobs(runtime).map(withConfigVersion);
}
function withConfigVersion(job: ScheduledJob): ScheduledJob {
  const organizations = buildOrganizationConfigSource();
  return {
    ...job,
    run: async (organizationId, now) => {
      const snapshot = await organizations.find(organizationId);
      if (snapshot === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
      await runWithRequestContext(
        { ...getRequestContext(), configVersion: snapshot.configVersion },
        () => job.run(organizationId, now),
      );
    },
  };
}
export function registerEnrollmentWorkerJobs(input: WorkerInput): void {
  for (const job of buildEnrollmentWorkerJobs(input)) registerScheduledJob(job);
}
