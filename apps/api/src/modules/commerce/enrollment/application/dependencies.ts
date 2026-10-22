import {
  ERROR_CODE,
  DomainRuleError,
  type EventPayloadMap,
  type EventType,
} from "@banijjik/contracts";
import { ENROLLMENT_EVENT_TYPE } from "@banijjik/contracts/enrollment";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { ResourceExclusiveHoldPort } from "../../booking/index.js";
import type { ApprovalVerifier } from "../../../core/iam/index.js";
import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";
import type { EnrollmentRepository, EnrollmentContext, EnrollmentCaller } from "./ports.js";

export interface EnrollmentDependencies {
  readonly repository: EnrollmentRepository;
  readonly context: EnrollmentContext;
  readonly holds: ResourceExclusiveHoldPort;
  readonly unitOfWork: { run<Result>(work: () => Promise<Result>): Promise<Result> };
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly approvals: Pick<ApprovalVerifier, "consume">;
  readonly events: {
    publish<Type extends EventType>(
      type: Type,
      payload: EventPayloadMap[Type],
      options: { orderingKey: string },
    ): Promise<void>;
  };
}
export function assertLocation(locationId: string, caller: EnrollmentCaller): void {
  if (caller.allowedLocationIds !== "ALL" && !caller.allowedLocationIds.includes(locationId))
    throw new DomainRuleError({ code: ERROR_CODE.LOCATION_FORBIDDEN });
}
export async function readEnrollment(
  dependencies: EnrollmentDependencies,
  caller: EnrollmentCaller,
  enrollmentId: string,
): Promise<Enrollment> {
  const enrollment = await dependencies.repository.find(enrollmentId);
  if (enrollment === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
  assertLocation(enrollment.locationId, caller);
  return enrollment;
}
export async function recordEnrollment(
  dependencies: EnrollmentDependencies,
  enrollment: Enrollment,
  event: Exclude<
    (typeof ENROLLMENT_EVENT_TYPE)[keyof typeof ENROLLMENT_EVENT_TYPE],
    typeof ENROLLMENT_EVENT_TYPE.ENROLLMENT_CHECK_IN_RECORDED
  >,
): Promise<void> {
  await dependencies.events.publish(
    event,
    {
      enrollmentId: enrollment.enrollmentId,
      enrollmentPeriodId: enrollment.currentEnrollmentPeriodId,
    },
    { orderingKey: `enrollment:${enrollment.enrollmentId}` },
  );
  await dependencies.audit.record({
    action: event,
    entityType: "enrollment",
    entityId: enrollment.enrollmentId,
  });
}
export async function releaseEnrollment(
  dependencies: EnrollmentDependencies,
  enrollment: Enrollment,
  endsOn: string,
): Promise<void> {
  await dependencies.repository.releaseSeat(enrollment);
  await dependencies.holds.release(enrollment.enrollmentId, endsOn, enrollment.updatedByUserId);
}
export function auditFields(
  caller: EnrollmentCaller,
  locationId: string,
  now: Date,
): import("../domain/enrollment.entity.js").EnrollmentAuditFields {
  return {
    organizationId: caller.organizationId,
    locationId,
    createdAt: now,
    updatedAt: now,
    createdByUserId: caller.actorUserId,
    updatedByUserId: caller.actorUserId,
  };
}
export function checkVersion(enrollment: Enrollment, version: number): void {
  if (enrollment.version !== version)
    throw new DomainRuleError({
      code: ERROR_CODE.CONFLICT,
      details: { currentVersion: enrollment.version },
    });
}
export async function detail(
  dependencies: EnrollmentDependencies,
  caller: EnrollmentCaller,
  enrollmentId: string,
): Promise<Enrollment & { periods: readonly EnrollmentPeriod[] }> {
  const enrollment = await readEnrollment(dependencies, caller, enrollmentId);
  const { items: periods } = await dependencies.repository.periodPage(enrollmentId, {
    page: 1,
    limit: 100,
  });
  return { ...enrollment, periods };
}
