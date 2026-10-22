import type { EnrollmentDependencies } from "./application/dependencies.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { registerScheduledJob } from "../../../kernel/jobs/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { buildApprovalVerifier } from "../../core/iam/index.js";
import { MongoResourceExclusiveHolds } from "../booking/index.js";
import { MongoEnrollmentRepository } from "./infrastructure/mongo-enrollment.repository.js";
import {
  buildEnrollmentContext,
  type EnrollmentContextInput,
} from "./infrastructure/enrollment-context.js";
import { buildEnrollmentJobs } from "./application/enrollment-jobs.js";
export { enrollmentManifest } from "./module.manifest.js";
export { registerEnrollmentModels } from "./infrastructure/enrollment.schema.js";
export { buildEnrollmentRouter } from "./presentation/enrollment.router.js";
export { buildEnrollmentJobs } from "./application/enrollment-jobs.js";

export function buildEnrollmentDependencies(
  input: EnrollmentContextInput & { audit: AuditRecorder; clock: Clock },
): EnrollmentDependencies {
  return {
    repository: new MongoEnrollmentRepository(),
    context: buildEnrollmentContext(input),
    holds: new MongoResourceExclusiveHolds(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: input.audit,
    clock: input.clock,
    approvals: buildApprovalVerifier(input),
  };
}
export function registerEnrollmentScheduledJobs(
  input: EnrollmentContextInput & { audit: AuditRecorder; clock: Clock },
): void {
  for (const job of buildEnrollmentJobs(buildEnrollmentDependencies(input)))
    registerScheduledJob(job);
}

export type { EnrollmentDependencies } from "./application/dependencies.js";
