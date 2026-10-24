import type { EnrollmentDependencies } from "./application/dependencies.js";
import type { EnrollmentPaymentPort } from "./application/ports.js";
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
import type { Enrollment, EnrollmentPeriod } from "./domain/enrollment.entity.js";
export { enrollmentManifest } from "./module.manifest.js";
export { registerEnrollmentModels } from "./infrastructure/enrollment.schema.js";
export { buildEnrollmentRouter } from "./presentation/enrollment.router.js";
export { buildEnrollmentJobs } from "./application/enrollment-jobs.js";
export { buildSyncEnrollmentPaymentsHandler } from "./application/handlers/sync-enrollment-payments.handler.js";
export type { EnrollmentPaymentPort } from "./application/ports.js";

export function buildEnrollmentDependencies(
  input: EnrollmentContextInput & {
    audit: AuditRecorder;
    clock: Clock;
    payments: EnrollmentPaymentPort;
  },
): EnrollmentDependencies {
  return {
    repository: new MongoEnrollmentRepository(),
    context: buildEnrollmentContext(input),
    payments: input.payments,
    holds: new MongoResourceExclusiveHolds(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: input.audit,
    clock: input.clock,
    approvals: buildApprovalVerifier(input),
  };
}
export function registerEnrollmentScheduledJobs(
  input: EnrollmentContextInput & {
    audit: AuditRecorder;
    clock: Clock;
    payments: EnrollmentPaymentPort;
  },
): void {
  for (const job of buildEnrollmentJobs(buildEnrollmentDependencies(input)))
    registerScheduledJob(job);
}

/**
 * The period and its enrollment for a payment request id (card 3.27). A function, not a Mongo
 * class: routes/enrollment-request-reader.ts turns this into the payment RequestReadSnapshot.
 */
export interface EnrollmentPeriodSnapshot {
  readonly period: EnrollmentPeriod;
  readonly enrollment: Enrollment;
}
export interface EnrollmentPeriodSnapshotReader {
  read(
    organizationId: string,
    enrollmentPeriodId: string,
  ): Promise<EnrollmentPeriodSnapshot | undefined>;
}
export function buildEnrollmentPeriodSnapshotReader(): EnrollmentPeriodSnapshotReader {
  const repository = new MongoEnrollmentRepository();
  return {
    read: async (organizationId, enrollmentPeriodId) => {
      const period = await repository.findPeriod(organizationId, enrollmentPeriodId);
      if (period === undefined) return undefined;
      const enrollment = await repository.find(period.enrollmentId);
      if (enrollment === undefined) return undefined;
      return { period, enrollment };
    },
  };
}

export type { EnrollmentDependencies } from "./application/dependencies.js";
