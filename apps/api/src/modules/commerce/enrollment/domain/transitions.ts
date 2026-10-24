import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  ENROLLMENT_RULE_KEY,
  ENROLLMENT_STATUS,
  type EnrollmentAction,
} from "@banijjik/contracts/enrollment";
import type { Enrollment, EnrollmentPeriod } from "./enrollment.entity.js";
import { addDays, daysBetween } from "./period-dates.js";

export function transitionRefused(messageKey: string = ENROLLMENT_RULE_KEY.TRANSITION): never {
  throw new DomainRuleError({ code: ERROR_CODE.VALIDATION_ERROR, messageKey });
}
export function assertTransition(enrollment: Enrollment, action: EnrollmentAction): void {
  const states = ENROLLMENT_STATUS;
  const allowed = {
    // A paid current period lifts an OVERDUE enrollment back to ACTIVE (card 3.27, ADR-139).
    activate: [states.PENDING, states.OVERDUE],
    freeze: [states.ACTIVE],
    unfreeze: [states.FROZEN],
    cancel: [states.PENDING, states.ACTIVE, states.FROZEN, states.OVERDUE],
    renew: [states.ACTIVE, states.OVERDUE],
    expire: [states.PENDING, states.ACTIVE, states.OVERDUE],
    complete: [states.ACTIVE, states.OVERDUE],
    markOverdue: [states.ACTIVE],
  } as const;
  const permitted: readonly string[] = allowed[action];
  if (!permitted.includes(enrollment.status)) transitionRefused();
}
export function freezeEnrollment(
  enrollment: Enrollment,
  period: EnrollmentPeriod,
  today: string,
): { enrollment: Enrollment; period: EnrollmentPeriod } {
  if (!enrollment.plan.freezeAllowed) transitionRefused();
  const used = frozenDaysInYear(enrollment, today);
  const maximum = enrollment.plan.maxFreezeDaysPerYear;
  if (maximum !== undefined && used >= maximum) transitionRefused(ENROLLMENT_RULE_KEY.FREEZE_LIMIT);
  return {
    enrollment: {
      ...enrollment,
      status: ENROLLMENT_STATUS.FROZEN,
      freezes: [...enrollment.freezes, { frozenOn: today, daysFrozen: 0 }],
    },
    period: { ...period, originalEndsOn: period.originalEndsOn ?? period.periodEndsOn },
  };
}
export function frozenDaysInYear(enrollment: Enrollment, today: string): number {
  const yearStartsOn = `${today.slice(0, 4)}-01-01`;
  const yearEndsOn = `${Number(today.slice(0, 4)) + 1}-01-01`;
  return enrollment.freezes.reduce((total, freeze) => {
    const start = freeze.frozenOn > yearStartsOn ? freeze.frozenOn : yearStartsOn;
    const end = freeze.unfrozenOn ?? today;
    return total + Math.max(0, daysBetween(start, end < yearEndsOn ? end : yearEndsOn));
  }, 0);
}
export function unfreezeEnrollment(
  enrollment: Enrollment,
  period: EnrollmentPeriod,
  today: string,
): { enrollment: Enrollment; period: EnrollmentPeriod } {
  const freeze = enrollment.freezes.at(-1);
  if (freeze === undefined || freeze.unfrozenOn !== undefined) transitionRefused();
  const maximum = enrollment.plan.maxFreezeDaysPerYear;
  const usedBefore = frozenDaysInYear(
    { ...enrollment, freezes: enrollment.freezes.slice(0, -1) },
    freeze.frozenOn,
  );
  const allowance = maximum === undefined ? Infinity : Math.max(0, maximum - usedBefore);
  const daysFrozen = daysBetween(freeze.frozenOn, today);
  if (daysFrozen < 0) transitionRefused();
  return {
    enrollment: {
      ...enrollment,
      status: ENROLLMENT_STATUS.ACTIVE,
      freezes: [...enrollment.freezes.slice(0, -1), { ...freeze, unfrozenOn: today, daysFrozen }],
    },
    period: {
      ...period,
      periodEndsOn: addDays(period.periodEndsOn, Math.min(daysFrozen, allowance)),
    },
  };
}
