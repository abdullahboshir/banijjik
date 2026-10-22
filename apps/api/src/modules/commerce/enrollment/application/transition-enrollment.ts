import {
  ENROLLMENT_STATUS,
  ENROLLMENT_PERIOD_STATUS,
  ENROLLMENT_EVENT_TYPE,
  ENROLLMENT_RULE_KEY,
  ENROLLMENT_REFUND_POLICY,
  type EnrollmentAction,
} from "@banijjik/contracts/enrollment";
import type { Money } from "@banijjik/contracts/catalog";
import { newId } from "@banijjik/ids";
import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";
import {
  assertTransition,
  transitionRefused,
  freezeEnrollment,
  unfreezeEnrollment,
} from "../domain/transitions.js";
import { addBillingPeriod, addDays } from "../domain/period-dates.js";
import { refundableAmount } from "../domain/refunds.js";
import type { TransitionInput } from "./ports.js";
import {
  auditFields,
  checkVersion,
  readEnrollment,
  recordEnrollment,
  releaseEnrollment,
  type EnrollmentDependencies,
} from "./dependencies.js";

const events = {
  activate: ENROLLMENT_EVENT_TYPE.ENROLLMENT_ACTIVATED,
  freeze: ENROLLMENT_EVENT_TYPE.ENROLLMENT_FROZEN,
  unfreeze: ENROLLMENT_EVENT_TYPE.ENROLLMENT_UNFROZEN,
  cancel: ENROLLMENT_EVENT_TYPE.ENROLLMENT_CANCELLED,
  renew: ENROLLMENT_EVENT_TYPE.ENROLLMENT_RENEWED,
  expire: ENROLLMENT_EVENT_TYPE.ENROLLMENT_EXPIRED,
  complete: ENROLLMENT_EVENT_TYPE.ENROLLMENT_COMPLETED,
  markOverdue: ENROLLMENT_EVENT_TYPE.ENROLLMENT_OVERDUE,
};
type TransitionState = {
  input: TransitionInput;
  enrollment: Enrollment;
  period: EnrollmentPeriod;
  today: string;
  automated: boolean;
};
export interface TransitionResult {
  readonly enrollment: Enrollment;
  readonly refundableAmount?: Money;
}

export async function transitionEnrollment(
  dependencies: EnrollmentDependencies,
  input: TransitionInput,
  automated = false,
): Promise<TransitionResult> {
  return dependencies.unitOfWork.run(async () => {
    const enrollment = await readEnrollment(dependencies, input, input.enrollmentId);
    checkVersion(enrollment, input.version);
    assertTransition(enrollment, input.action);
    const period = await dependencies.repository.currentPeriod(enrollment);
    const today = await dependencies.context.today(input.organizationId, dependencies.clock.now());
    const next = await applyTransition(dependencies, {
      input,
      enrollment,
      period,
      today,
      automated,
    });
    const saved = await dependencies.repository.save(
      {
        ...next,
        updatedAt: dependencies.clock.now(),
        updatedByUserId: input.actorUserId,
        history: [
          ...enrollment.history,
          { action: input.action, on: today, actorUserId: input.actorUserId },
        ],
      },
      enrollment.version,
    );
    const event =
      next.status === ENROLLMENT_STATUS.COMPLETED
        ? ENROLLMENT_EVENT_TYPE.ENROLLMENT_COMPLETED
        : events[input.action];
    await recordEnrollment(dependencies, saved, event);
    if (input.action !== "cancel") return { enrollment: saved };
    return cancellationResult(dependencies, saved, today);
  });
}
async function cancellationResult(
  dependencies: EnrollmentDependencies,
  enrollment: Enrollment,
  today: string,
): Promise<TransitionResult> {
  const settings = await dependencies.context.settings(enrollment.organizationId);
  const policy =
    Object.values(ENROLLMENT_REFUND_POLICY).find((value) => value === settings.refundPolicy) ??
    ENROLLMENT_REFUND_POLICY.NONE;
  return {
    enrollment,
    refundableAmount: refundableAmount(
      await dependencies.repository.periods(enrollment.enrollmentId),
      today,
      { policy, currency: enrollment.firstRecurringFee.currency },
    ),
  };
}
async function applyTransition(
  dependencies: EnrollmentDependencies,
  state: TransitionState,
): Promise<Enrollment> {
  const { input, enrollment, period, today } = state;
  if (input.action === "renew") return renewEnrollment(dependencies, state);
  if (input.action === "freeze" || input.action === "unfreeze") {
    const next =
      input.action === "freeze"
        ? freezeEnrollment(enrollment, period, today)
        : unfreezeEnrollment(enrollment, period, today);
    await dependencies.repository.savePeriod(
      { ...next.period, updatedByUserId: input.actorUserId },
      input.action === "unfreeze",
    );
    return next.enrollment;
  }
  if (input.action === "activate") return activateEnrollment(dependencies, state);
  if (input.action === "markOverdue") return { ...enrollment, status: ENROLLMENT_STATUS.OVERDUE };
  const statuses = {
    cancel: ENROLLMENT_STATUS.CANCELLED,
    expire: ENROLLMENT_STATUS.EXPIRED,
    complete: ENROLLMENT_STATUS.COMPLETED,
  };
  const endsOn = input.action === "cancel" ? today : period.periodEndsOn;
  const next = {
    ...enrollment,
    status: statuses[input.action],
    endsOn,
    updatedByUserId: input.actorUserId,
  };
  await releaseEnrollment(dependencies, next, endsOn);
  return next;
}
async function activateEnrollment(
  dependencies: EnrollmentDependencies,
  state: TransitionState,
): Promise<Enrollment> {
  const settings = await dependencies.context.settings(state.input.organizationId);
  if (state.today < state.enrollment.startsOn) transitionRefused(ENROLLMENT_RULE_KEY.START_DATE);
  const paid =
    state.period.status === ENROLLMENT_PERIOD_STATUS.PAID ||
    state.period.status === ENROLLMENT_PERIOD_STATUS.WAIVED;
  if (settings.requirePayment && !paid) transitionRefused(ENROLLMENT_RULE_KEY.PAYMENT_REQUIRED);
  return { ...state.enrollment, status: ENROLLMENT_STATUS.ACTIVE };
}
async function renewEnrollment(
  dependencies: EnrollmentDependencies,
  state: TransitionState,
): Promise<Enrollment> {
  const { input, enrollment, period, today, automated } = state;
  if (!automated && enrollment.autoRenew) transitionRefused();
  if (today <= period.periodEndsOn) transitionRefused(ENROLLMENT_RULE_KEY.NOT_DUE);
  if (
    enrollment.plan.fixedTermPeriods !== undefined &&
    period.periodNumber >= enrollment.plan.fixedTermPeriods
  ) {
    const next = {
      ...enrollment,
      status: ENROLLMENT_STATUS.COMPLETED,
      endsOn: period.periodEndsOn,
      updatedByUserId: input.actorUserId,
    };
    await releaseEnrollment(dependencies, next, period.periodEndsOn);
    return next;
  }
  const settings = await dependencies.context.settings(input.organizationId);
  const plan = await dependencies.context.plan(enrollment);
  const fee = settings.lockPrice
    ? enrollment.firstRecurringFee
    : await dependencies.context.fee(input.organizationId, enrollment);
  const startsOn = addDays(period.periodEndsOn, 1);
  const enrollmentPeriodId = newId();
  await dependencies.repository.insertPeriod({
    ...auditFields(input, enrollment.locationId, dependencies.clock.now()),
    enrollmentPeriodId,
    enrollmentId: enrollment.enrollmentId,
    periodNumber: period.periodNumber + 1,
    periodStartsOn: startsOn,
    periodEndsOn: addDays(addBillingPeriod(startsOn, plan.billingPeriod), -1),
    fee,
    ...(plan.sessionLimitPerPeriod === undefined
      ? {}
      : { sessionsAllowed: plan.sessionLimitPerPeriod }),
    sessionsUsed: 0,
    status: ENROLLMENT_PERIOD_STATUS.OPEN,
    version: 1,
  });
  return { ...enrollment, currentEnrollmentPeriodId: enrollmentPeriodId };
}
export function transitionEvent(action: EnrollmentAction): (typeof events)[EnrollmentAction] {
  return events[action];
}
