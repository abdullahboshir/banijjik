import { ENROLLMENT_PERIOD_STATUS, ENROLLMENT_STATUS } from "@banijjik/contracts/enrollment";
import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";
import type { EnrollmentDependencies } from "./dependencies.js";
import { transitionEnrollment } from "./transition-enrollment.js";
import { syncPeriodPaymentStatus } from "./sync-period-payment.js";

/**
 * The payment-driven activation (decision 7): the just-synced period must be paid and current,
 * and the enrollment must wait for this exact event — a PENDING enrollment whose start date has
 * arrived, or an OVERDUE one whose debt was just cleared. A refund never takes it back.
 */
function mayActivateAfterPayment(
  enrollment: Enrollment,
  period: EnrollmentPeriod,
  today: string,
): boolean {
  if (period.enrollmentPeriodId !== enrollment.currentEnrollmentPeriodId) return false;
  const paid =
    period.status === ENROLLMENT_PERIOD_STATUS.PAID ||
    period.status === ENROLLMENT_PERIOD_STATUS.WAIVED;
  if (!paid) return false;
  if (enrollment.status === ENROLLMENT_STATUS.OVERDUE) return true;
  return enrollment.status === ENROLLMENT_STATUS.PENDING && today >= enrollment.startsOn;
}

/**
 * Recomputes every enrollment period a payment touched and applies the payment-driven
 * transitions. UNORDERED and idempotent, because the status is derived from the payment
 * summary, never from the event: a second delivery syncs the same amounts and finds the
 * enrollment already ACTIVE, so nothing transitions twice.
 */
export async function syncEnrollmentPaymentsForPayment(
  dependencies: EnrollmentDependencies,
  organizationId: string,
  paymentId: string,
): Promise<void> {
  await dependencies.unitOfWork.run(async () => {
    const periodIds = await dependencies.payments.listPeriodIdsOfPayment(paymentId);
    for (const enrollmentPeriodId of periodIds) {
      await syncOnePeriod(dependencies, organizationId, enrollmentPeriodId);
    }
  });
}

/** Syncs one period and activates its enrollment when the payment lifts it. */
async function syncOnePeriod(
  dependencies: EnrollmentDependencies,
  organizationId: string,
  enrollmentPeriodId: string,
): Promise<void> {
  const period = await dependencies.repository.findPeriod(organizationId, enrollmentPeriodId);
  if (period === undefined) return;
  const enrollment = await dependencies.repository.find(period.enrollmentId);
  if (enrollment === undefined) return;
  const synced = await syncPeriodPaymentStatus(dependencies, period);
  const today = await dependencies.context.today(organizationId, dependencies.clock.now());
  if (!mayActivateAfterPayment(enrollment, synced, today)) return;
  await transitionEnrollment(
    dependencies,
    {
      organizationId,
      enrollmentId: enrollment.enrollmentId,
      actorUserId: null,
      allowedLocationIds: "ALL",
      version: enrollment.version,
      action: "activate",
    },
    true,
  );
}
