import type { Money } from "@banijjik/contracts/catalog";
import {
  ENROLLMENT_EVENT_TYPE,
  ENROLLMENT_PERIOD_STATUS,
  ENROLLMENT_STATUS,
} from "@banijjik/contracts/enrollment";
import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";
import type { EnrollmentDependencies } from "./dependencies.js";
import type { TransitionInput } from "./ports.js";

type RevenueDependencies = Pick<
  EnrollmentDependencies,
  "repository" | "payments" | "events" | "clock"
>;

export interface TransitionRevenueInput {
  readonly dependencies: RevenueDependencies;
  readonly input: Pick<TransitionInput, "action" | "actorUserId">;
  readonly enrollment: Enrollment;
  /** The enrollment as it was before the transition: its current period is the one that ended. */
  readonly previous: Enrollment;
  readonly today: string;
}

/**
 * Activation and renewal start revenue on the period that is in service (decision 2). A renewal
 * recognises the new current period on its start date, never on the run date (A3). A PENDING
 * enrollment has no revenue yet (A2).
 */
export async function settleRevenueAfterTransition(input: TransitionRevenueInput): Promise<void> {
  const { dependencies, enrollment, previous, today } = input;
  const { action, actorUserId } = input.input;
  if (action === "activate") {
    const current = await dependencies.repository.currentPeriod(enrollment);
    await recognizePeriodRevenue(dependencies, {
      enrollment,
      period: current,
      businessDate: today,
      actorUserId,
      summaryTotal: current.fee,
      announce: true,
    });
    return;
  }
  const switched = enrollment.currentEnrollmentPeriodId !== previous.currentEnrollmentPeriodId;
  if (action !== "renew" || !switched) return;
  if (enrollment.status === ENROLLMENT_STATUS.PENDING) return;
  const current = await dependencies.repository.currentPeriod(enrollment);
  await recognizePeriodRevenue(dependencies, {
    enrollment,
    period: current,
    businessDate: current.periodStartsOn,
    actorUserId,
    summaryTotal: current.fee,
    announce: true,
  });
}

export interface RecognitionInput {
  readonly enrollment: Enrollment;
  readonly period: EnrollmentPeriod;
  /** Local business date the revenue is recognised on (decision 2 table). */
  readonly businessDate: string;
  readonly actorUserId: string | null;
  /** What the payment summary holds afterwards: the fee on activate and renew, the kept amount on cancel. */
  readonly summaryTotal: Money;
  /** False on cancel: the close event replaces the recognition event (decision 6). */
  readonly announce: boolean;
}

/**
 * Starts a period's revenue once (decision 2). A period that already has `revenueRecognizedOn`
 * is returned unchanged, so a replayed transition posts nothing twice (A9). A WAIVED period
 * never starts revenue.
 */
export async function recognizePeriodRevenue(
  dependencies: RevenueDependencies,
  input: RecognitionInput,
): Promise<EnrollmentPeriod> {
  const { enrollment, period } = input;
  if (period.revenueRecognizedOn !== undefined) return period;
  if (period.status === ENROLLMENT_PERIOD_STATUS.WAIVED) return period;
  const now = dependencies.clock.now();
  // Touch the summary first (decision 4): a payment that read BEFORE_REVENUE conflicts here.
  await dependencies.payments.touchForRevenue({
    organizationId: enrollment.organizationId,
    enrollmentPeriodId: period.enrollmentPeriodId,
    locationId: period.locationId,
    contactId: enrollment.billToContactId,
    total: input.summaryTotal,
    now,
  });
  const next: EnrollmentPeriod = {
    ...period,
    revenueRecognizedOn: input.businessDate,
    updatedAt: now,
    updatedByUserId: input.actorUserId,
  };
  await dependencies.repository.savePeriod(next, false);
  if (input.announce) {
    await dependencies.events.publish(
      ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_RECOGNIZED,
      {
        enrollmentId: enrollment.enrollmentId,
        enrollmentPeriodId: period.enrollmentPeriodId,
      },
      { orderingKey: `enrollmentPeriod:${period.enrollmentPeriodId}` },
    );
  }
  return { ...next, version: period.version + 1 };
}

/**
 * Closes every non-waived period of a cancelled enrollment at what the business kept (decision 6).
 * Runs inside the cancel transaction, after the summaries were capped at their net paid.
 */
export async function closeCancelledPeriods(input: {
  readonly dependencies: RevenueDependencies;
  readonly enrollment: Enrollment;
  readonly cancelDate: string;
  readonly input: Pick<TransitionInput, "actorUserId">;
}): Promise<void> {
  const { dependencies, enrollment, cancelDate } = input;
  const actorUserId = input.input.actorUserId;
  for (const period of await dependencies.repository.periods(enrollment.enrollmentId)) {
    if (period.status === ENROLLMENT_PERIOD_STATUS.WAIVED) continue;
    const kept = await dependencies.payments.readNetPaid({
      organizationId: enrollment.organizationId,
      enrollmentPeriodId: period.enrollmentPeriodId,
    });
    await closeOnePeriod(dependencies, { enrollment, period, kept, cancelDate, actorUserId });
  }
}

async function closeOnePeriod(
  dependencies: RevenueDependencies,
  input: {
    readonly enrollment: Enrollment;
    readonly period: EnrollmentPeriod;
    readonly kept: Money;
    readonly cancelDate: string;
    readonly actorUserId: string | null;
  },
): Promise<void> {
  const { enrollment, period, kept, cancelDate, actorUserId } = input;
  const recognizedBeforeCancel = period.revenueRecognizedOn !== undefined;
  if (!recognizedBeforeCancel && kept.amount <= 0) return;
  let closedPeriod = period;
  if (!recognizedBeforeCancel) {
    closedPeriod = await recognizePeriodRevenue(dependencies, {
      enrollment,
      period,
      businessDate: cancelDate,
      actorUserId,
      summaryTotal: kept,
      announce: false,
    });
  }
  await dependencies.events.publish(
    ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_CLOSED,
    {
      enrollmentId: enrollment.enrollmentId,
      enrollmentPeriodId: period.enrollmentPeriodId,
      keptAmount: kept,
      recognizedAmount: recognizedBeforeCancel ? period.fee : kept,
      recognizedBeforeCancel,
    },
    { orderingKey: `enrollmentPeriod:${closedPeriod.enrollmentPeriodId}` },
  );
}
