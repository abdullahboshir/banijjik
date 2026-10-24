import { COMMISSION_SOURCE_TYPE } from "@banijjik/contracts/commission";
import { businessDateOf } from "../domain/business-date.js";
import {
  newRefundAdjustmentEntry,
  type CommissionEntry,
} from "../domain/commission-entry.entity.js";
import { returnAdjustmentDelta } from "../domain/reconcile-commission.js";
import {
  NOTHING_DONE,
  addResults,
  publishRecorded,
  sumOf,
  type AccrualDependencies,
  type AccrualResult,
  type CommissionEventContext,
} from "./accrual-shared.js";
import type { OrderCommissionFacts } from "./ports/commission-ports.js";
import { groupByLedger } from "./reconcile-sources.js";

/**
 * Brings each performed line's commission in line with the units the customer gave back (plan 3.5b
 * decision 10). The adjustment uses the existing adjustment kind; its `refundedTotalSeen` is 0,
 * because no refund was seen: the source of the change is the return.
 */
export async function reconcileOrderLinesByReturn(
  dependencies: AccrualDependencies,
  order: OrderCommissionFacts,
  context: CommissionEventContext,
): Promise<AccrualResult> {
  const entries = await dependencies.entries.listBySource(
    COMMISSION_SOURCE_TYPE.ORDER_LINE,
    order.orderId,
  );
  let result = NOTHING_DONE;
  for (const ledgerEntries of groupByLedger(entries)) {
    const ledgerResult = await reconcileLedgerOfReturn({
      dependencies,
      ledgerEntries,
      order,
      context,
    });
    result = addResults(result, ledgerResult);
  }
  return result;
}

async function reconcileLedgerOfReturn(input: {
  readonly dependencies: AccrualDependencies;
  readonly ledgerEntries: readonly CommissionEntry[];
  readonly order: OrderCommissionFacts;
  readonly context: CommissionEventContext;
}): Promise<AccrualResult> {
  const { dependencies, ledgerEntries, order, context } = input;
  const accrual = ledgerEntries.find((entry) => entry.sequence === 1);
  if (accrual === undefined) return NOTHING_DONE;
  const line = order.lines.find((candidate) => candidate.orderLineId === accrual.sourceLineId);
  if (line === undefined) return NOTHING_DONE;
  const currency = accrual.amount.currency;
  const delta = returnAdjustmentDelta({
    accrual: accrual.amount,
    soldQuantity: line.quantity,
    returnedQuantity: line.returnedQuantity,
    currentNet: sumOf(ledgerEntries, currency),
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
    sequence: Math.max(...ledgerEntries.map((entry) => entry.sequence)) + 1,
    amount: { amount: delta, currency },
    base: accrual.base,
    sourceGrossTotal: accrual.sourceGrossTotal,
    refundedTotalSeen: { amount: 0, currency },
    ruleSnapshot: accrual.ruleSnapshot,
    businessDate: businessDateOf(context.occurredAt, timeZone),
    now: dependencies.clock.now(),
    actorUserId: context.actorUserId,
  });
  const outcome = await dependencies.entries.insertIfAbsent(adjustment);
  // A parallel reconcile took this sequence. Failing makes the event run again with a fresh read.
  if (outcome === "exists") throw new Error("commission sequence taken by a parallel reconcile");
  await publishRecorded(dependencies, adjustment);
  return { ...NOTHING_DONE, adjustments: 1 };
}
