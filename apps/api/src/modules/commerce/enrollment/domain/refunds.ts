import {
  ENROLLMENT_PERIOD_STATUS,
  ENROLLMENT_REFUND_POLICY,
  type EnrollmentRefundPolicy,
} from "@banijjik/contracts/enrollment";
import type { Money } from "@banijjik/contracts/catalog";
import type { EnrollmentPeriod } from "./enrollment.entity.js";
import { addDays, daysBetween } from "./period-dates.js";

/** Only fully paid periods have a known refundable balance before the payment integration. */
export function refundableAmount(
  periods: readonly EnrollmentPeriod[],
  today: string,
  input: { policy: EnrollmentRefundPolicy; currency: Money["currency"] },
): Money {
  const { policy, currency } = input;
  let amount = 0n;
  for (const period of periods) {
    if (period.status !== ENROLLMENT_PERIOD_STATUS.PAID) continue;
    if (policy === ENROLLMENT_REFUND_POLICY.UNUSED_PERIODS && period.periodStartsOn > today)
      amount += BigInt(period.fee.amount);
    if (policy !== ENROLLMENT_REFUND_POLICY.PRORATED) continue;
    if (period.periodStartsOn > today || period.periodEndsOn < today) continue;
    const totalDays = daysBetween(period.periodStartsOn, addDays(period.periodEndsOn, 1));
    const unusedDays = daysBetween(today, addDays(period.periodEndsOn, 1));
    amount += (BigInt(period.fee.amount) * BigInt(unusedDays)) / BigInt(totalDays);
  }
  return { amount: Number(amount), currency };
}
