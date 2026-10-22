import { MODULE_KEY } from "@banijjik/contracts";
import {
  ENROLLMENT_STATUS,
  ENROLLMENT_PERIOD_STATUS,
  ENROLLMENT_EVENT_TYPE,
  ENROLLMENT_JOB,
  ENROLLMENT_TERMINAL_STATUSES,
} from "@banijjik/contracts/enrollment";
import type { ScheduledJob } from "../../../../kernel/jobs/index.js";
import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";
import type { EnrollmentSettings } from "./ports.js";
import { addDays } from "../domain/period-dates.js";
import { transitionEnrollment } from "./transition-enrollment.js";
import { recordEnrollment, type EnrollmentDependencies } from "./dependencies.js";

type JobState = {
  enrollment: Enrollment;
  period: EnrollmentPeriod;
  today: string;
  settings: EnrollmentSettings;
};
export function buildEnrollmentJobs(dependencies: EnrollmentDependencies): readonly ScheduledJob[] {
  return Object.values(ENROLLMENT_JOB).map((jobKey) => ({
    jobKey,
    everyMinutes: 1,
    moduleKey: MODULE_KEY.ENROLLMENT,
    run: async (organizationId, now) => {
      if (!(await dependencies.context.isLocalMidnight(organizationId, now))) return;
      let after: string | undefined;
      for (;;) {
        const rows = await dependencies.repository.candidates(after);
        if (rows.length === 0) return;
        for (const row of rows)
          await runEnrollmentJob(dependencies, { jobKey, candidate: row, now });
        after = rows.at(-1)?.enrollmentId;
      }
    },
  }));
}
async function runEnrollmentJob(
  dependencies: EnrollmentDependencies,
  input: { jobKey: string; candidate: Enrollment; now: Date },
) {
  await dependencies.unitOfWork.run(async () => {
    const enrollment = await dependencies.repository.find(input.candidate.enrollmentId);
    if (
      enrollment === undefined ||
      enrollment.status === ENROLLMENT_STATUS.FROZEN ||
      ENROLLMENT_TERMINAL_STATUSES.includes(enrollment.status)
    )
      return;
    const state: JobState = {
      enrollment,
      period: await dependencies.repository.currentPeriod(enrollment),
      today: await dependencies.context.today(enrollment.organizationId, input.now),
      settings: await dependencies.context.settings(enrollment.organizationId),
    };
    if (input.jobKey === ENROLLMENT_JOB.RENEW) await renewOrExpire(dependencies, state);
    if (input.jobKey === ENROLLMENT_JOB.OVERDUE) await markOverdue(dependencies, state);
    if (input.jobKey === ENROLLMENT_JOB.REMIND) await remind(dependencies, state);
  });
}
function callerOf(enrollment: Enrollment) {
  return {
    organizationId: enrollment.organizationId,
    enrollmentId: enrollment.enrollmentId,
    actorUserId: null,
    allowedLocationIds: "ALL" as const,
    version: enrollment.version,
  };
}
async function renewOrExpire(dependencies: EnrollmentDependencies, state: JobState) {
  const { enrollment, period, today } = state;
  if (today <= period.periodEndsOn) return;
  const fixedTermDone =
    enrollment.plan.fixedTermPeriods !== undefined &&
    period.periodNumber >= enrollment.plan.fixedTermPeriods;
  if (fixedTermDone && enrollment.status !== ENROLLMENT_STATUS.PENDING) {
    await transitionEnrollment(dependencies, { ...callerOf(enrollment), action: "complete" }, true);
    return;
  }
  if (enrollment.autoRenew && enrollment.status !== ENROLLMENT_STATUS.PENDING) {
    await transitionEnrollment(dependencies, { ...callerOf(enrollment), action: "renew" }, true);
    return;
  }
  await transitionEnrollment(dependencies, { ...callerOf(enrollment), action: "expire" }, true);
}
async function markOverdue(dependencies: EnrollmentDependencies, state: JobState) {
  const { enrollment, period, today, settings } = state;
  if (enrollment.status !== ENROLLMENT_STATUS.ACTIVE) return;
  if (today <= addDays(period.periodStartsOn, settings.graceDays)) return;
  if (
    period.status === ENROLLMENT_PERIOD_STATUS.PAID ||
    period.status === ENROLLMENT_PERIOD_STATUS.WAIVED
  )
    return;
  await transitionEnrollment(
    dependencies,
    { ...callerOf(enrollment), action: "markOverdue" },
    true,
  );
}
async function remind(dependencies: EnrollmentDependencies, state: JobState) {
  if (state.today !== addDays(state.period.periodEndsOn, -state.settings.reminderDays)) return;
  if (!(await dependencies.repository.markReminder(state.enrollment, state.today))) return;
  await recordEnrollment(
    dependencies,
    state.enrollment,
    ENROLLMENT_EVENT_TYPE.ENROLLMENT_RENEWAL_DUE,
  );
}
