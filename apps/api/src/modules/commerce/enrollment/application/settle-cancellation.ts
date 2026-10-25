import { ENROLLMENT_PERIOD_STATUS, ENROLLMENT_REFUND_POLICY } from "@banijjik/contracts/enrollment";
import type { Enrollment } from "../domain/enrollment.entity.js";
import { refundableAmount, refundableByPeriod } from "../domain/refunds.js";
import type { EnrollmentDependencies } from "./dependencies.js";
import type { TransitionInput } from "./ports.js";
import type { TransitionResult } from "./transition-enrollment.js";
import { closeCancelledPeriods } from "./period-revenue.js";
export async function settleCancellation(
  dependencies: EnrollmentDependencies,
  settlement: { input: TransitionInput; enrollment: Enrollment; today: string },
): Promise<TransitionResult> {
  const { input, enrollment, today } = settlement;
  const periods = await dependencies.repository.periods(enrollment.enrollmentId);
  const settings = await dependencies.context.settings(enrollment.organizationId);
  const policy =
    Object.values(ENROLLMENT_REFUND_POLICY).find((value) => value === settings.refundPolicy) ??
    ENROLLMENT_REFUND_POLICY.NONE;
  const amounts = refundableByPeriod(periods, today, {
    policy,
    currency: enrollment.firstRecurringFee.currency,
  });
  for (const period of periods) {
    const amount = amounts.get(period.enrollmentPeriodId);
    if (!amount) continue;
    const refunded = await dependencies.payments.readRefunded({
      organizationId: enrollment.organizationId,
      enrollmentPeriodId: period.enrollmentPeriodId,
    });
    await dependencies.repository.savePeriod(
      {
        ...period,
        refundableOnCancel: amount,
        refundedAtCancel: refunded,
        updatedByUserId: input.actorUserId,
      },
      false,
    );
  }
  await capPeriodSummaries(dependencies, enrollment);
  await closeCancelledPeriods({ dependencies, enrollment, cancelDate: today, input });
  return cancellationResult(dependencies, enrollment, today);
}
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
    refundableByPeriod: (await dependencies.repository.periods(enrollment.enrollmentId)).map(
      (period) => ({
        enrollmentPeriodId: period.enrollmentPeriodId,
        amount: period.refundableOnCancel ?? { amount: 0, currency: period.fee.currency },
      }),
    ),
    refundableAmount: refundableAmount(
      await dependencies.repository.periods(enrollment.enrollmentId),
      today,
      { policy, currency: enrollment.firstRecurringFee.currency },
    ),
  };
}
