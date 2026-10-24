import type { Money } from "@banijjik/contracts/accounting";
import { BOOKING_STATUS } from "@banijjik/contracts/booking";
import {
  COMMISSION_EVENT_TYPE,
  COMMISSION_SOURCE_TYPE,
  type CommissionRuleSnapshot,
} from "@banijjik/contracts/commission";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import {
  asId,
  type LocationId,
  type MemberId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type { Logger } from "../../../../kernel/logger/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import { businessDateOf } from "../domain/business-date.js";
import {
  newAccrualEntry,
  newRefundAdjustmentEntry,
  type CommissionEntry,
} from "../domain/commission-entry.entity.js";
import { refundAdjustmentDelta } from "../domain/reconcile-commission.js";
import {
  resolveCommissionRule,
  type CommissionResolution,
  type CommissionRuleCandidate,
} from "../domain/resolve-commission-rule.js";
import type {
  BookingCommissionFacts,
  CommissionEntryRepository,
  CommissionEventPublisher,
  CommissionMemberRoleReader,
  CommissionOfferingReader,
  CommissionPaymentReader,
  CommissionRuleRepository,
  CommissionSourceMarkRepository,
  CommissionSourceReader,
  CommissionTimezoneReader,
  CommissionUnitOfWork,
} from "./ports/commission-ports.js";

export interface AccrualDependencies {
  readonly rules: Pick<CommissionRuleRepository, "listActiveForSubjects">;
  readonly entries: Pick<CommissionEntryRepository, "insertIfAbsent" | "listBySource">;
  readonly marks: Pick<CommissionSourceMarkRepository, "touch">;
  readonly bookings: Pick<CommissionSourceReader, "readBooking">;
  readonly payments: CommissionPaymentReader;
  readonly offerings: CommissionOfferingReader;
  readonly memberRoles: CommissionMemberRoleReader;
  readonly timezones: CommissionTimezoneReader;
  readonly events: CommissionEventPublisher;
  readonly unitOfWork: CommissionUnitOfWork;
  readonly clock: Clock;
  readonly logger: Pick<Logger, "debug" | "warn">;
}

export interface CommissionEventContext {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId | null;
  readonly occurredAt: Date;
}

/** What a run did, so a test or a log line can tell a replay from a first run. */
export interface AccrualResult {
  readonly accruals: number;
  readonly adjustments: number;
  readonly skippedCurrency: number;
}

const NOTHING_DONE: AccrualResult = { accruals: 0, adjustments: 0, skippedCurrency: 0 };

function orderingKeyOf(memberId: string): string {
  return `commission:${memberId}`;
}

function snapshotOf(rule: CommissionRuleCandidate): CommissionRuleSnapshot {
  return {
    commissionRuleId: rule.commissionRuleId,
    subjectType: rule.subjectType,
    targetType: rule.targetType,
    calculation: rule.calculation,
    percentBasisPoints: rule.percentBasisPoints,
    fixedAmount: rule.fixedAmount,
  };
}

function sumOf(entries: readonly CommissionEntry[], currency: Money["currency"]): Money {
  return { amount: entries.reduce((total, entry) => total + entry.amount.amount, 0), currency };
}

async function publishRecorded(
  dependencies: AccrualDependencies,
  entry: CommissionEntry,
): Promise<void> {
  await dependencies.events.publish(
    COMMISSION_EVENT_TYPE.ENTRY_RECORDED,
    { commissionEntryId: entry.commissionEntryId },
    { orderingKey: orderingKeyOf(entry.memberId) },
  );
}

type ProvidedBooking = BookingCommissionFacts & { readonly providerMemberId: string };

/** The price after discount, without tax: the base the commission is taken from (owner decision). */
function baseOf(booking: ProvidedBooking): Money {
  return {
    amount: booking.price.total.amount - booking.price.tax.amount,
    currency: booking.price.currency,
  };
}

async function resolveBookingRule(
  dependencies: AccrualDependencies,
  booking: ProvidedBooking,
): Promise<CommissionResolution | undefined> {
  const offering = await dependencies.offerings.readOffering(booking.offeringId);
  if (offering === undefined) return undefined;
  const roleIds = await dependencies.memberRoles.roleIdsAt(
    booking.providerMemberId,
    booking.locationId,
  );
  const rules = await dependencies.rules.listActiveForSubjects({
    memberId: booking.providerMemberId,
    roleIds,
  });
  return resolveCommissionRule(
    {
      memberId: booking.providerMemberId,
      roleIds,
      offeringId: booking.offeringId,
      offeringKind: offering.kind,
      categoryIds: offering.categoryIds,
      base: baseOf(booking),
      quantity: booking.quantity,
    },
    rules,
  );
}

/**
 * Writes the ACCRUAL of a completed booking that has a provider and a matching rule. A replay finds
 * the accrual already there and writes nothing. Runs inside the caller's transaction.
 */
async function accrueBooking(
  dependencies: AccrualDependencies,
  booking: ProvidedBooking,
  context: CommissionEventContext,
): Promise<AccrualResult> {
  const resolution = await resolveBookingRule(dependencies, booking);
  if (resolution === undefined) return NOTHING_DONE;
  if (resolution.outcome === "NO_RULE") {
    dependencies.logger.debug({ bookingId: booking.bookingId }, "commission.no_rule");
    return NOTHING_DONE;
  }
  if (resolution.outcome === "CURRENCY_MISMATCH") {
    dependencies.logger.warn(
      { bookingId: booking.bookingId, commissionRuleId: resolution.commissionRuleId },
      "commission.accrual_skipped_currency",
    );
    return { ...NOTHING_DONE, skippedCurrency: 1 };
  }
  const timeZone = await dependencies.timezones.read(context.organizationId);
  const entry = newAccrualEntry({
    organizationId: context.organizationId,
    memberId: asId<MemberId>(booking.providerMemberId),
    locationId: asId<LocationId>(booking.locationId),
    sourceId: booking.bookingId,
    sourceNumber: booking.bookingNumber,
    amount: resolution.amount,
    base: baseOf(booking),
    sourceGrossTotal: booking.price.total,
    ruleSnapshot: snapshotOf(resolution.rule),
    businessDate: businessDateOf(context.occurredAt, timeZone),
    now: dependencies.clock.now(),
    actorUserId: context.actorUserId,
  });
  const outcome = await dependencies.entries.insertIfAbsent(entry);
  if (outcome === "exists") return NOTHING_DONE;
  await publishRecorded(dependencies, entry);
  return { ...NOTHING_DONE, accruals: 1 };
}

/**
 * Brings the net of one member's entries for one source in line with the source's cumulative
 * refund (ADR-135). Only the delta is written, so a replay, a late refund event and a refund
 * that arrived before the completion all end with the same ledger.
 */
async function reconcileMember(
  dependencies: AccrualDependencies,
  memberEntries: readonly CommissionEntry[],
  context: CommissionEventContext,
): Promise<AccrualResult> {
  const accrual = memberEntries.find((entry) => entry.sequence === 1);
  if (accrual === undefined) return NOTHING_DONE;
  const refundedRead = await dependencies.payments.readRefunded(
    PAYMENT_REQUEST_TYPE.BOOKING,
    accrual.sourceId,
  );
  const currency = accrual.sourceGrossTotal.currency;
  if (refundedRead !== undefined && refundedRead.currency !== currency) {
    dependencies.logger.warn(
      { sourceId: accrual.sourceId, memberId: accrual.memberId },
      "commission.reconcile_skipped_currency",
    );
    return { ...NOTHING_DONE, skippedCurrency: 1 };
  }
  const refunded: Money = {
    amount: Math.min(refundedRead?.amount ?? 0, accrual.sourceGrossTotal.amount),
    currency,
  };
  const delta = refundAdjustmentDelta({
    accrual: accrual.amount,
    sourceGrossTotal: accrual.sourceGrossTotal,
    refunded,
    currentNet: sumOf(memberEntries, currency),
  });
  if (delta === 0) return NOTHING_DONE;
  const timeZone = await dependencies.timezones.read(context.organizationId);
  const adjustment = newRefundAdjustmentEntry({
    organizationId: context.organizationId,
    memberId: accrual.memberId,
    locationId: accrual.locationId,
    sourceId: accrual.sourceId,
    sourceNumber: accrual.sourceNumber,
    sequence: Math.max(...memberEntries.map((entry) => entry.sequence)) + 1,
    amount: { amount: delta, currency },
    base: accrual.base,
    sourceGrossTotal: accrual.sourceGrossTotal,
    refundedTotalSeen: refunded,
    ruleSnapshot: accrual.ruleSnapshot,
    businessDate: businessDateOf(context.occurredAt, timeZone),
    now: dependencies.clock.now(),
    actorUserId: context.actorUserId,
  });
  const outcome = await dependencies.entries.insertIfAbsent(adjustment);
  // A parallel reconcile took this sequence. Failing makes the event run again with a fresh read, which then finds delta 0.
  if (outcome === "exists") throw new Error("commission sequence taken by a parallel reconcile");
  await publishRecorded(dependencies, adjustment);
  return { ...NOTHING_DONE, adjustments: 1 };
}

function groupByMember(entries: readonly CommissionEntry[]): CommissionEntry[][] {
  const groups = new Map<string, CommissionEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.memberId) ?? [];
    group.push(entry);
    groups.set(entry.memberId, group);
  }
  return [...groups.values()];
}

function addResults(left: AccrualResult, right: AccrualResult): AccrualResult {
  return {
    accruals: left.accruals + right.accruals,
    adjustments: left.adjustments + right.adjustments,
    skippedCurrency: left.skippedCurrency + right.skippedCurrency,
  };
}

async function reconcileBooking(
  dependencies: AccrualDependencies,
  bookingId: string,
  context: CommissionEventContext,
): Promise<AccrualResult> {
  const entries = await dependencies.entries.listBySource(
    COMMISSION_SOURCE_TYPE.BOOKING,
    bookingId,
  );
  let result = NOTHING_DONE;
  for (const memberEntries of groupByMember(entries)) {
    result = addResults(result, await reconcileMember(dependencies, memberEntries, context));
  }
  return result;
}

/** `booking.booking.completed`: accrue (once), then reconcile against any refund that came first. */
export async function accrueCompletedBooking(
  dependencies: AccrualDependencies,
  input: { readonly bookingId: string; readonly context: CommissionEventContext },
): Promise<AccrualResult> {
  return dependencies.unitOfWork.run(async () => {
    // Touched first: a refund reconcile of the same booking then conflicts with this transaction instead of missing it.
    await dependencies.marks.touch(COMMISSION_SOURCE_TYPE.BOOKING, input.bookingId);
    const booking = await dependencies.bookings.readBooking(input.bookingId);
    if (booking === undefined || booking.status !== BOOKING_STATUS.COMPLETED) return NOTHING_DONE;
    if (booking.providerMemberId === null) return NOTHING_DONE;
    const existing = await dependencies.entries.listBySource(
      COMMISSION_SOURCE_TYPE.BOOKING,
      input.bookingId,
    );
    // A replay of the completion finds the accrual and goes straight to reconcile.
    const accrued =
      existing.length > 0
        ? NOTHING_DONE
        : await accrueBooking(
            dependencies,
            { ...booking, providerMemberId: booking.providerMemberId },
            input.context,
          );
    const reconciled = await reconcileBooking(dependencies, input.bookingId, input.context);
    return addResults(accrued, reconciled);
  });
}

/** `payment.payment.refunded` / `reversed`: reconcile every booking the payment touched that already has an accrual. */
export async function reconcilePaymentBookings(
  dependencies: AccrualDependencies,
  input: { readonly paymentId: string; readonly context: CommissionEventContext },
): Promise<AccrualResult> {
  return dependencies.unitOfWork.run(async () => {
    const allocations = await dependencies.payments.readAllocations(input.paymentId);
    const bookingIds = new Set(
      allocations
        .filter((allocation) => allocation.requestType === PAYMENT_REQUEST_TYPE.BOOKING)
        .map((allocation) => allocation.requestId),
    );
    let result = NOTHING_DONE;
    for (const bookingId of bookingIds) {
      await dependencies.marks.touch(COMMISSION_SOURCE_TYPE.BOOKING, bookingId);
      result = addResults(result, await reconcileBooking(dependencies, bookingId, input.context));
    }
    return result;
  });
}
