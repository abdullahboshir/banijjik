import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  ENROLLMENT_PERIOD_STATUS,
  ENROLLMENT_RULE_KEY,
  type EnrollmentPeriodStatus,
} from "@banijjik/contracts/enrollment";
import type { EnrollmentPeriod } from "../domain/enrollment.entity.js";
import type { EnrollmentDependencies } from "./dependencies.js";

type SyncDependencies = Pick<EnrollmentDependencies, "repository" | "payments" | "clock">;

/**
 * Period status is derived from the payment summary, never counted (decision 5): recomputing it
 * from net paid is idempotent, so the payment event handler can run in any order and twice.
 * Callers run this inside their transaction, before reading the period status.
 */
export async function syncPeriodPaymentStatus(
  dependencies: SyncDependencies,
  period: EnrollmentPeriod,
  actorUserId: string | null = null,
): Promise<EnrollmentPeriod> {
  if (period.status === ENROLLMENT_PERIOD_STATUS.WAIVED) return period;
  const paid = await dependencies.payments.readNetPaid({
    organizationId: period.organizationId,
    enrollmentPeriodId: period.enrollmentPeriodId,
  });
  if (paid.currency !== period.fee.currency) {
    throw new DomainRuleError({
      code: ERROR_CODE.BUSINESS_RULE,
      messageKey: ENROLLMENT_RULE_KEY.CURRENCY_MISMATCH,
      details: { enrollmentPeriodId: period.enrollmentPeriodId },
    });
  }
  const status = derivedStatus(period, paid.amount);
  if (status === period.status) return period;
  const next: EnrollmentPeriod = {
    ...period,
    status,
    updatedAt: dependencies.clock.now(),
    updatedByUserId: actorUserId,
  };
  await dependencies.repository.savePeriod(next, false);
  return next;
}

function derivedStatus(period: EnrollmentPeriod, netPaidMinor: number): EnrollmentPeriodStatus {
  if (netPaidMinor >= period.fee.amount) return ENROLLMENT_PERIOD_STATUS.PAID;
  if (netPaidMinor > 0) return ENROLLMENT_PERIOD_STATUS.PARTIAL;
  return ENROLLMENT_PERIOD_STATUS.OPEN;
}
