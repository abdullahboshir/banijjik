import { DomainRuleError, ERROR_CODE, SEQUENCE_KEY } from "@banijjik/contracts";
import {
  ENROLLMENT_STATUS,
  ENROLLMENT_PERIOD_STATUS,
  ENROLLMENT_RULE_KEY,
  ENROLLMENT_EVENT_TYPE,
} from "@banijjik/contracts/enrollment";
import { newId } from "@banijjik/ids";
import type { EnrollmentCreateBody } from "@banijjik/validation/enrollment";
import { nextSequenceValue } from "../../../../kernel/sequence/index.js";
import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";
import { addBillingPeriod, addDays, addMoney } from "../domain/period-dates.js";
import { transitionRefused } from "../domain/transitions.js";
import type { EnrollmentCaller } from "./ports.js";
import {
  assertLocation,
  auditFields,
  recordEnrollment,
  type EnrollmentDependencies,
} from "./dependencies.js";

export async function createEnrollment(
  dependencies: EnrollmentDependencies,
  caller: EnrollmentCaller,
  body: EnrollmentCreateBody,
): Promise<Enrollment> {
  assertLocation(body.locationId, caller);
  const enrollmentNumber = String(
    await nextSequenceValue({
      organizationId: caller.organizationId,
      sequenceKey: SEQUENCE_KEY.ENROLLMENT,
    }),
  ).padStart(6, "0");
  return dependencies.unitOfWork.run(async () => {
    const { enrollment, period } = await prepareEnrollment(dependencies, caller, {
      body,
      enrollmentNumber,
    });
    await dependencies.repository.takeSeat(enrollment);
    await dependencies.holds.take({
      enrollmentId: enrollment.enrollmentId,
      resourceIds: enrollment.resourceIds,
      locationId: enrollment.locationId,
      startsOn: enrollment.startsOn,
      endsOn: null,
      actorUserId: caller.actorUserId,
    });
    await dependencies.repository.insert(enrollment, period);
    await recordEnrollment(dependencies, enrollment, ENROLLMENT_EVENT_TYPE.ENROLLMENT_CREATED);
    return enrollment;
  });
}
async function prepareEnrollment(
  dependencies: EnrollmentDependencies,
  caller: EnrollmentCaller,
  input: { body: EnrollmentCreateBody; enrollmentNumber: string },
) {
  const { body, enrollmentNumber } = input;
  const now = dependencies.clock.now();
  const today = await dependencies.context.today(caller.organizationId, now);
  const plan = await dependencies.context.plan(body);
  if (plan.startRule === "FIXED_DATES" && !plan.startDates?.includes(body.startsOn))
    transitionRefused(ENROLLMENT_RULE_KEY.START_DATE);
  if (!(await dependencies.context.activeContact(body.contactId)))
    throw new DomainRuleError({
      code: ERROR_CODE.VALIDATION_ERROR,
      messageKey: ENROLLMENT_RULE_KEY.CONTACT,
    });
  const settings = await dependencies.context.settings(caller.organizationId);
  const fee = await dependencies.context.fee(caller.organizationId, body);
  const common = auditFields(caller, body.locationId, now);
  const enrollmentId = newId();
  const enrollmentPeriodId = newId();
  const enrollment: Enrollment = {
    ...common,
    enrollmentId,
    enrollmentNumber,
    contactId: body.contactId,
    billToContactId: await dependencies.context.payer(
      caller.organizationId,
      body.contactId,
      body.billToContactId,
    ),
    offeringId: body.offeringId,
    variantId: body.variantId,
    startsOn: body.startsOn,
    status:
      !settings.requirePayment && body.startsOn <= today
        ? ENROLLMENT_STATUS.ACTIVE
        : ENROLLMENT_STATUS.PENDING,
    autoRenew: body.autoRenew ?? plan.autoRenewDefault,
    currentEnrollmentPeriodId: enrollmentPeriodId,
    securityDepositHeld: plan.securityDeposit ?? { amount: 0, currency: fee.currency },
    resourceIds: body.resourceIds,
    freezes: [],
    customFields: await dependencies.context.fields(caller.organizationId, body.customFields),
    plan,
    firstRecurringFee: fee,
    version: 1,
    history: [{ action: "create", on: today, actorUserId: caller.actorUserId }],
  };
  const period = firstPeriod(enrollment, caller);
  return { enrollment, period };
}

function firstPeriod(enrollment: Enrollment, caller: EnrollmentCaller): EnrollmentPeriod {
  return {
    ...auditFields(caller, enrollment.locationId, enrollment.createdAt),
    enrollmentPeriodId: enrollment.currentEnrollmentPeriodId,
    enrollmentId: enrollment.enrollmentId,
    periodNumber: 1,
    periodStartsOn: enrollment.startsOn,
    periodEndsOn: addDays(addBillingPeriod(enrollment.startsOn, enrollment.plan.billingPeriod), -1),
    fee:
      enrollment.plan.admissionFee === undefined
        ? enrollment.firstRecurringFee
        : addMoney(enrollment.firstRecurringFee, enrollment.plan.admissionFee),
    ...(enrollment.plan.sessionLimitPerPeriod === undefined
      ? {}
      : { sessionsAllowed: enrollment.plan.sessionLimitPerPeriod }),
    sessionsUsed: 0,
    status: ENROLLMENT_PERIOD_STATUS.OPEN,
    version: 1,
  };
}
