import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";
import type { TransitionInput } from "./ports.js";
import { recordEnrollment, type EnrollmentDependencies } from "./dependencies.js";

/** Automated renewal into an already attached period is audited only; everything else publishes. */
export async function recordTransition(
  dependencies: EnrollmentDependencies,
  record: {
    input: TransitionInput;
    automated: boolean;
    event: Parameters<typeof recordEnrollment>[2];
    saved: Enrollment;
    period: EnrollmentPeriod;
    advancePeriod: EnrollmentPeriod | undefined;
  },
): Promise<void> {
  const { input, automated, event, saved, period, advancePeriod } = record;
  if (input.action === "renew" && automated && advancePeriod !== undefined) {
    await dependencies.audit.record({
      action: event,
      entityType: "enrollment",
      entityId: saved.enrollmentId,
    });
    return;
  }
  const renewed =
    input.action === "renew" ? await dependencies.repository.nextPeriod(saved, period) : undefined;
  await recordEnrollment(
    dependencies,
    {
      ...saved,
      currentEnrollmentPeriodId: renewed?.enrollmentPeriodId ?? saved.currentEnrollmentPeriodId,
    },
    event,
  );
}
