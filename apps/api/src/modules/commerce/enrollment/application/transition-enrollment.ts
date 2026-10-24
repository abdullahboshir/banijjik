import {
  ENROLLMENT_STATUS,
  ENROLLMENT_PERIOD_STATUS,
  ENROLLMENT_EVENT_TYPE,
  ENROLLMENT_RULE_KEY,
  ENROLLMENT_REFUND_POLICY,
  type EnrollmentAction,
  type EnrollmentStatus,
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
import { syncPeriodPaymentStatus } from "./sync-period-payment.js";
import { closeCancelledPeriods, settleRevenueAfterTransition } from "./period-revenue.js";
import { recordTransition } from "./record-transition.js";
import {
  auditFields,
  checkVersion,
  readEnrollment,
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
  advancePeriod: EnrollmentPeriod | undefined;
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
    const advancePeriod = await dependencies.repository.nextPeriod(enrollment, period);
    const next = await applyTransition(dependencies, {
      input,
      enrollment,
      period,
      today,
      automated,
      advancePeriod,
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
    const event = eventForTransition(input.action, next.status);
    await recordTransition(dependencies, { input, automated, event, saved, period, advancePeriod });
    await settleRevenueAfterTransition({
      dependencies,
      input,
      previous: enrollment,
      enrollment: saved,
      today,
    });
    if (input.action !== "cancel") return { enrollment: saved };
    return settleCancellation(dependencies, { input, enrollment: saved, today });
  });
}
/** Completion can arrive through several actions; it always emits the completed event. */
function eventForTransition(
  action: EnrollmentAction,
  status: EnrollmentStatus,
): (typeof events)[EnrollmentAction] {
  if (status === ENROLLMENT_STATUS.COMPLETED) return ENROLLMENT_EVENT_TYPE.ENROLLMENT_COMPLETED;
  return events[action];
}
/** Cap the summaries first, then close the periods at what was kept (decision 6). */
async function settleCancellation(
  dependencies: EnrollmentDependencies,
  settlement: { input: TransitionInput; enrollment: Enrollment; today: string },
): Promise<TransitionResult> {
  const { input, enrollment, today } = settlement;
  await capPeriodSummaries(dependencies, enrollment);
  await closeCancelledPeriods({ dependencies, enrollment, cancelDate: today, input });
  return cancellationResult(dependencies, enrollment, today);
}
/** A cancelled enrollment owes nothing more: every non-waived period's summary total drops to its net paid (decision 4). */
async function capPeriodSummaries(
  dependencies: EnrollmentDependencies,
  enrollment: Enrollment,
): Promise<void> {
  const now = dependencies.clock.now();
  for (const period of await dependencies.repository.periods(enrollment.enrollmentId)) {
    if (period.status === ENROLLMENT_PERIOD_STATUS.WAIVED) continue;
    await dependencies.payments.capTotalAtNetPaid({
      organizationId: enrollment.organizationId,
      enrollmentPeriodId: period.enrollmentPeriodId,
      now,
    });
  }
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
  if (input.action === "freeze" || input.action === "unfreeze")
    return updateFreeze(dependencies, state);
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
  let releaseOn = addDays(endsOn, 1);
  if (input.action === "cancel")
    releaseOn = today < enrollment.startsOn ? enrollment.startsOn : today;
  await releaseEnrollment(dependencies, next, releaseOn);
  return next;
}
async function updateFreeze(
  dependencies: EnrollmentDependencies,
  state: TransitionState,
): Promise<Enrollment> {
  const { input, enrollment, period, today } = state;
  if (input.action === "freeze" && state.advancePeriod !== undefined)
    transitionRefused(ENROLLMENT_RULE_KEY.ADVANCE_PERIOD);
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
async function activateEnrollment(
  dependencies: EnrollmentDependencies,
  state: TransitionState,
): Promise<Enrollment> {
  const settings = await dependencies.context.settings(state.input.organizationId);
  if (state.today < state.enrollment.startsOn) transitionRefused(ENROLLMENT_RULE_KEY.START_DATE);
  // Staff activating right after a payment must not wait for the worker (decision 6).
  const period = await syncPeriodPaymentStatus(dependencies, state.period, state.input.actorUserId);
  const paid =
    period.status === ENROLLMENT_PERIOD_STATUS.PAID ||
    period.status === ENROLLMENT_PERIOD_STATUS.WAIVED;
  // Being overdue means unpaid: recovery needs the current period paid even when activation
  // generally does not require payment (decision 7).
  const mustPay = settings.requirePayment || state.enrollment.status === ENROLLMENT_STATUS.OVERDUE;
  if (mustPay && !paid) transitionRefused(ENROLLMENT_RULE_KEY.PAYMENT_REQUIRED);
  return { ...state.enrollment, status: ENROLLMENT_STATUS.ACTIVE };
}
function validateRenewalTiming(state: TransitionState): void {
  const { enrollment, period, today, automated } = state;
  if (!automated && enrollment.autoRenew) transitionRefused();
  if (automated && today <= period.periodEndsOn) transitionRefused(ENROLLMENT_RULE_KEY.NOT_DUE);
  if (!automated && today > period.periodEndsOn) transitionRefused(ENROLLMENT_RULE_KEY.NOT_DUE);
}
async function renewEnrollment(
  dependencies: EnrollmentDependencies,
  state: TransitionState,
): Promise<Enrollment> {
  const { input, enrollment, period, automated } = state;
  validateRenewalTiming(state);
  if (state.advancePeriod !== undefined) {
    if (!automated) transitionRefused(ENROLLMENT_RULE_KEY.ALREADY_RENEWED);
    return { ...enrollment, currentEnrollmentPeriodId: state.advancePeriod.enrollmentPeriodId };
  }
  if (
    enrollment.plan.fixedTermPeriods !== undefined &&
    period.periodNumber >= enrollment.plan.fixedTermPeriods
  ) {
    if (!automated) transitionRefused(ENROLLMENT_RULE_KEY.NOT_DUE);
    const next = {
      ...enrollment,
      status: ENROLLMENT_STATUS.COMPLETED,
      endsOn: period.periodEndsOn,
      updatedByUserId: input.actorUserId,
    };
    await releaseEnrollment(dependencies, next, addDays(period.periodEndsOn, 1));
    return next;
  }
  return appendRenewalPeriod(dependencies, state);
}
async function appendRenewalPeriod(
  dependencies: EnrollmentDependencies,
  state: TransitionState,
): Promise<Enrollment> {
  const { input, enrollment, period, automated } = state;
  const settings = await dependencies.context.settings(input.organizationId);
  if (!(await dependencies.context.canRenew(enrollment)))
    transitionRefused(ENROLLMENT_RULE_KEY.PLAN);
  const plan = enrollment.plan;
  const fee = settings.lockPrice
    ? enrollment.firstRecurringFee
    : await dependencies.context.fee(input.organizationId, enrollment);
  const startsOn = addDays(period.periodEndsOn, 1);
  const enrollmentPeriodId = newId();
  const now = dependencies.clock.now();
  await dependencies.repository.insertPeriod({
    ...auditFields(input, enrollment.locationId, now),
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
  await dependencies.payments.initializeSummary({
    organizationId: enrollment.organizationId,
    enrollmentPeriodId,
    contactId: enrollment.billToContactId,
    locationId: enrollment.locationId,
    fee,
    now,
  });
  return automated ? { ...enrollment, currentEnrollmentPeriodId: enrollmentPeriodId } : enrollment;
}
export function transitionEvent(action: EnrollmentAction): (typeof events)[EnrollmentAction] {
  return events[action];
}
