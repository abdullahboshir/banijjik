import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  CHECK_IN_METHOD,
  ENROLLMENT_EVENT_TYPE,
  ENROLLMENT_RULE_KEY,
  ENROLLMENT_STATUS,
} from "@banijjik/contracts/enrollment";
import { newId } from "@banijjik/ids";
import type { CheckInCreateBody } from "@banijjik/validation/enrollment";
import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";
import { transitionRefused } from "../domain/transitions.js";
import type { EnrollmentCaller, CheckIn } from "./ports.js";
import {
  assertLocation,
  auditFields,
  readEnrollment,
  type EnrollmentDependencies,
} from "./dependencies.js";

export async function createCheckIn(
  dependencies: EnrollmentDependencies,
  caller: EnrollmentCaller,
  body: CheckInCreateBody,
): Promise<CheckIn> {
  assertLocation(body.locationId, caller);
  return dependencies.unitOfWork.run(async () => {
    if (!(await dependencies.context.activeContact(body.contactId)))
      transitionRefused(ENROLLMENT_RULE_KEY.CONTACT);
    const now = dependencies.clock.now();
    const today = await dependencies.context.today(caller.organizationId, now);
    const enrollment = await selectEnrollment(dependencies, caller, body);
    const access =
      enrollment === undefined
        ? {
            bookingId: await dependencies.context.bookingForToday({
              contactId: body.contactId,
              locationId: body.locationId,
              today,
              ...(body.bookingId === undefined ? {} : { bookingId: body.bookingId }),
            }),
          }
        : await consumeSession(dependencies, { caller, body, enrollment, today });
    if (enrollment === undefined && access.bookingId === undefined) transitionRefused();
    const checkIn = assembleCheckIn(caller, body, {
      enrollment,
      bookingId: access.bookingId,
      now,
      today,
    });
    await dependencies.repository.checkIn(checkIn);
    await dependencies.events.publish(
      ENROLLMENT_EVENT_TYPE.ENROLLMENT_CHECK_IN_RECORDED,
      {
        checkInId: checkIn.checkInId,
        ...(checkIn.enrollmentId === undefined ? {} : { enrollmentId: checkIn.enrollmentId }),
        ...(checkIn.bookingId === undefined ? {} : { bookingId: checkIn.bookingId }),
      },
      { orderingKey: `enrollment:${enrollment?.enrollmentId ?? checkIn.checkInId}` },
    );
    await dependencies.audit.record({
      action: ENROLLMENT_EVENT_TYPE.ENROLLMENT_CHECK_IN_RECORDED,
      entityType: "checkIn",
      entityId: checkIn.checkInId,
    });
    return checkIn;
  });
}
async function selectEnrollment(
  dependencies: EnrollmentDependencies,
  caller: EnrollmentCaller,
  body: CheckInCreateBody,
) {
  if (body.bookingId !== undefined) return undefined;
  if (body.enrollmentId !== undefined)
    return readEnrollment(dependencies, caller, body.enrollmentId);
  const page = await dependencies.repository.list({
    page: 1,
    limit: 1,
    locationId: body.locationId,
    contactId: body.contactId,
    status: ENROLLMENT_STATUS.ACTIVE,
  });
  if (page.items[0] !== undefined) return page.items[0];
  const overdue = await dependencies.repository.list({
    page: 1,
    limit: 1,
    locationId: body.locationId,
    contactId: body.contactId,
    status: ENROLLMENT_STATUS.OVERDUE,
  });
  return overdue.items[0];
}
async function consumeSession(
  dependencies: EnrollmentDependencies,
  input: {
    caller: EnrollmentCaller;
    body: CheckInCreateBody;
    enrollment: Enrollment;
    today: string;
  },
): Promise<{ enrollmentId: string; enrollmentPeriodId: string; bookingId?: never }> {
  const { caller, body, enrollment, today } = input;
  if (enrollment.contactId !== body.contactId || enrollment.locationId !== body.locationId)
    transitionRefused();
  const settings = await dependencies.context.settings(caller.organizationId);
  const allowedOverdue = enrollment.status === ENROLLMENT_STATUS.OVERDUE && !settings.blockOverdue;
  if (enrollment.status !== ENROLLMENT_STATUS.ACTIVE && !allowedOverdue) transitionRefused();
  const period = await dependencies.repository.currentPeriod(enrollment);
  if (today < period.periodStartsOn || today > period.periodEndsOn) transitionRefused();
  await approveSession(dependencies, { caller, body, enrollment, period });
  await dependencies.repository.savePeriod(
    { ...period, sessionsUsed: period.sessionsUsed + 1, updatedByUserId: caller.actorUserId },
    false,
  );
  await dependencies.repository.save(
    { ...enrollment, updatedByUserId: caller.actorUserId, updatedAt: dependencies.clock.now() },
    enrollment.version,
  );
  return { enrollmentId: enrollment.enrollmentId, enrollmentPeriodId: period.enrollmentPeriodId };
}
async function approveSession(
  dependencies: EnrollmentDependencies,
  input: {
    caller: EnrollmentCaller;
    body: CheckInCreateBody;
    enrollment: Enrollment;
    period: EnrollmentPeriod;
  },
): Promise<void> {
  const { caller, body, enrollment, period } = input;
  if (period.sessionsAllowed === undefined || period.sessionsUsed < period.sessionsAllowed) return;
  if (body.approvalToken === undefined || caller.actorUserId === null)
    throw new DomainRuleError({
      code: ERROR_CODE.APPROVAL_REQUIRED,
      messageKey: ENROLLMENT_RULE_KEY.SESSION_LIMIT,
    });
  await dependencies.approvals.consume(body.approvalToken, {
    action: APPROVAL_ACTION.SESSION_LIMIT_OVERRIDE,
    subjectKey: `enrollment:${enrollment.enrollmentId}`,
    locationId: enrollment.locationId,
    requestedByUserId: caller.actorUserId,
  });
}

function assembleCheckIn(
  caller: EnrollmentCaller,
  body: CheckInCreateBody,
  input: {
    enrollment: Enrollment | undefined;
    bookingId: string | undefined;
    now: Date;
    today: string;
  },
): CheckIn {
  const { enrollment, bookingId, now, today } = input;
  return {
    ...auditFields(caller, body.locationId, now),
    checkInId: newId(),
    contactId: body.contactId,
    checkedInOn: today,
    checkedInAt: now,
    recordedByUserId: caller.actorUserId,
    method: CHECK_IN_METHOD.STAFF,
    ...(enrollment === undefined
      ? {}
      : {
          enrollmentId: enrollment.enrollmentId,
          enrollmentPeriodId: enrollment.currentEnrollmentPeriodId,
        }),
    ...(bookingId === undefined ? {} : { bookingId: bookingId }),
  };
}
