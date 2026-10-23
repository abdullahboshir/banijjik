import { getLogger } from "../../../../kernel/logger/index.js";
import { frozenDaysInYear } from "../domain/transitions.js";
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
import { addDays, daysBetween } from "../domain/period-dates.js";
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
    everyMinutes: 60,
    moduleKey: MODULE_KEY.ENROLLMENT,
    run: async (organizationId, now) => {
      void organizationId;
      let after: string | undefined;
      for (;;) {
        const rows = await dependencies.repository.candidates(after);
        if (rows.length === 0) return;
        for (const row of rows) {
          try {
            await runEnrollmentJob(dependencies, { jobKey, candidate: row, now });
          } catch (err) {
            getLogger().error(
              { event: "enrollment.job_item_failed", jobKey, enrollmentId: row.enrollmentId, err },
              "Enrollment job item failed; continuing",
            );
          }
        }
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
    let enrollment = await dependencies.repository.find(input.candidate.enrollmentId);
    if (enrollment === undefined || ENROLLMENT_TERMINAL_STATUSES.includes(enrollment.status))
      return;
    if (input.jobKey === ENROLLMENT_JOB.RENEW)
      enrollment = await prepareRenewal(dependencies, enrollment, input.now);
    if (enrollment.status === ENROLLMENT_STATUS.FROZEN) return;
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
  const advancePeriod = await dependencies.repository.nextPeriod(enrollment, period);
  const mayRenew =
    advancePeriod !== undefined ||
    (enrollment.autoRenew && (await dependencies.context.canRenew(enrollment)));
  if (mayRenew && enrollment.status !== ENROLLMENT_STATUS.PENDING) {
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
  if (
    state.today < addDays(state.period.periodEndsOn, -state.settings.reminderDays) ||
    state.today > state.period.periodEndsOn
  )
    return;
  if (!(await dependencies.repository.markReminder(state.enrollment))) return;
  await recordEnrollment(
    dependencies,
    state.enrollment,
    ENROLLMENT_EVENT_TYPE.ENROLLMENT_RENEWAL_DUE,
  );
}

async function prepareRenewal(
  dependencies: EnrollmentDependencies,
  enrollment: Enrollment,
  now: Date,
): Promise<Enrollment> {
  const today = await dependencies.context.today(enrollment.organizationId, now);
  if (enrollment.status === ENROLLMENT_STATUS.FROZEN) {
    const maximum = enrollment.plan.maxFreezeDaysPerYear;
    const freeze = enrollment.freezes.at(-1);
    if (maximum === undefined || freeze === undefined || freeze.unfrozenOn !== undefined)
      return enrollment;
    const usedBefore = frozenDaysInYear(
      { ...enrollment, freezes: enrollment.freezes.slice(0, -1) },
      freeze.frozenOn,
    );
    const elapsed = daysBetween(freeze.frozenOn, today);
    if (elapsed < Math.max(0, maximum - usedBefore)) return enrollment;
    return (
      await transitionEnrollment(
        dependencies,
        { ...callerOf(enrollment), action: "unfreeze" },
        true,
      )
    ).enrollment;
  }
  if (enrollment.status === ENROLLMENT_STATUS.PENDING && today >= enrollment.startsOn) {
    const settings = await dependencies.context.settings(enrollment.organizationId);
    if (!settings.requirePayment)
      return (
        await transitionEnrollment(
          dependencies,
          { ...callerOf(enrollment), action: "activate" },
          true,
        )
      ).enrollment;
  }
  return enrollment;
}
