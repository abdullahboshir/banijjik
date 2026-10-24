import type { Money } from "@banijjik/contracts/accounting";
import { COMMISSION_SOURCE_TYPE, type CommissionSourceType } from "@banijjik/contracts/commission";
import { PAYMENT_REQUEST_TYPE, type PaymentRequestType } from "@banijjik/contracts/payment";
import { businessDateOf } from "../domain/business-date.js";
import {
  newRefundAdjustmentEntry,
  type CommissionEntry,
} from "../domain/commission-entry.entity.js";
import { refundAdjustmentDelta } from "../domain/reconcile-commission.js";
import {
  NOTHING_DONE,
  PAYMENT_REQUEST_OF_SOURCE,
  addResults,
  publishRecorded,
  sumOf,
  type AccrualDependencies,
  type AccrualResult,
  type CommissionEventContext,
} from "./accrual-shared.js";

/** Brings the net of one member's entries for one source line in line with the source's refund. */
async function reconcileMember(
  dependencies: AccrualDependencies,
  memberEntries: readonly CommissionEntry[],
  context: CommissionEventContext,
): Promise<AccrualResult> {
  const accrual = memberEntries.find((entry) => entry.sequence === 1);
  if (accrual === undefined) return NOTHING_DONE;
  const refundedRead = await dependencies.payments.readRefunded(
    PAYMENT_REQUEST_OF_SOURCE[accrual.sourceType],
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
    sourceType: accrual.sourceType,
    sourceId: accrual.sourceId,
    sourceLineId: accrual.sourceLineId,
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

/** One ledger per source line and member; a booking has no line, so its ledger key has an empty line part. */
function ledgerKeyOf(entry: CommissionEntry): string {
  return `${entry.sourceLineId ?? ""}|${entry.memberId}`;
}

function groupByLedger(entries: readonly CommissionEntry[]): CommissionEntry[][] {
  const groups = new Map<string, CommissionEntry[]>();
  for (const entry of entries) {
    const key = ledgerKeyOf(entry);
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export async function reconcileSource(
  dependencies: AccrualDependencies,
  source: { readonly sourceType: CommissionSourceType; readonly sourceId: string },
  context: CommissionEventContext,
): Promise<AccrualResult> {
  const entries = await dependencies.entries.listBySource(source.sourceType, source.sourceId);
  let result = NOTHING_DONE;
  for (const ledgerEntries of groupByLedger(entries)) {
    result = addResults(result, await reconcileMember(dependencies, ledgerEntries, context));
  }
  return result;
}

/** Reconciles one source of a payment allocation: a booking, or every performed line of an order. */
async function reconcileAllocation(
  dependencies: AccrualDependencies,
  allocation: { readonly requestType: PaymentRequestType; readonly requestId: string },
  context: CommissionEventContext,
): Promise<AccrualResult> {
  if (allocation.requestType === PAYMENT_REQUEST_TYPE.BOOKING) {
    await dependencies.marks.touch(COMMISSION_SOURCE_TYPE.BOOKING, allocation.requestId);
    return reconcileSource(
      dependencies,
      { sourceType: COMMISSION_SOURCE_TYPE.BOOKING, sourceId: allocation.requestId },
      context,
    );
  }
  if (allocation.requestType === PAYMENT_REQUEST_TYPE.ORDER) {
    await dependencies.marks.touch(COMMISSION_SOURCE_TYPE.ORDER_LINE, allocation.requestId);
    return reconcileSource(
      dependencies,
      { sourceType: COMMISSION_SOURCE_TYPE.ORDER_LINE, sourceId: allocation.requestId },
      context,
    );
  }
  return NOTHING_DONE;
}

/**
 * `payment.payment.refunded` / `reversed`: reconcile every booking and order the payment touched that
 * already has an accrual. An allocation with no accrual is skipped; a later completion reconciles itself.
 */
export async function reconcilePaymentSources(
  dependencies: AccrualDependencies,
  input: { readonly paymentId: string; readonly context: CommissionEventContext },
): Promise<AccrualResult> {
  return dependencies.unitOfWork.run(async () => {
    const allocations = await dependencies.payments.readAllocations(input.paymentId);
    const seen = new Set<string>();
    let result = NOTHING_DONE;
    for (const allocation of allocations) {
      const key = `${allocation.requestType}:${allocation.requestId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result = addResults(
        result,
        await reconcileAllocation(dependencies, allocation, input.context),
      );
    }
    return result;
  });
}
