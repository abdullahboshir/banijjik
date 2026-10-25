import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  ENROLLMENT_PERIOD_STATUS,
  ENROLLMENT_REFUND_POLICY,
  type EnrollmentRefundPolicy,
} from "@banijjik/contracts/enrollment";
import type { Money } from "@banijjik/contracts/catalog";
import type { EnrollmentPeriod } from "./enrollment.entity.js";
import { addDays, daysBetween } from "./period-dates.js";

type RefundPolicy = { policy: EnrollmentRefundPolicy; currency: Money["currency"] };

export function refundableAmount(
  periods: readonly EnrollmentPeriod[],
  today: string,
  input: RefundPolicy,
): Money {
  let amount = 0n;
  for (const refund of refundableByPeriod(periods, today, input).values())
    amount += BigInt(refund.amount);
  return { amount: Number(amount), currency: input.currency };
}
export function refundableByPeriod(
  periods: readonly EnrollmentPeriod[],
  today: string,
  input: RefundPolicy,
): ReadonlyMap<string, Money> {
  const result = new Map<string, Money>();
  for (const period of periods) {
    if (period.fee.currency !== input.currency)
      throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
    result.set(period.enrollmentPeriodId, {
      amount: periodRefund(period, today, input.policy),
      currency: input.currency,
    });
  }
  return result;
}
function periodRefund(
  period: EnrollmentPeriod,
  today: string,
  policy: EnrollmentRefundPolicy,
): number {
  if (period.status !== ENROLLMENT_PERIOD_STATUS.PAID || policy === ENROLLMENT_REFUND_POLICY.NONE)
    return 0;
  if (period.periodStartsOn > today) return period.fee.amount;
  if (policy !== ENROLLMENT_REFUND_POLICY.PRORATED || period.periodEndsOn < today) return 0;
  const end = addDays(period.periodEndsOn, 1);
  return Number(
    (BigInt(period.fee.amount) * BigInt(daysBetween(today, end))) /
      BigInt(daysBetween(period.periodStartsOn, end)),
  );
}
export function refundRemaining(
  period: Pick<EnrollmentPeriod, "fee" | "refundableOnCancel" | "refundedAtCancel">,
  refunded: Money,
): Money {
  const stored = period.refundableOnCancel ?? { amount: 0, currency: period.fee.currency };
  const baseline = period.refundedAtCancel ?? { amount: 0, currency: stored.currency };
  if (stored.currency !== refunded.currency || baseline.currency !== stored.currency)
    throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
  return {
    amount: Math.max(0, stored.amount - Math.max(0, refunded.amount - baseline.amount)),
    currency: stored.currency,
  };
}
