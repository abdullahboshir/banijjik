import type { Money } from "@banijjik/contracts/accounting";
import { BOOKING_STATUS } from "@banijjik/contracts/booking";
import { COMMISSION_SOURCE_TYPE, type CommissionSourceType } from "@banijjik/contracts/commission";
import { ORDER_STATUS } from "@banijjik/contracts/sales";
import { asId, type LocationId, type MemberId } from "@banijjik/ids";
import { businessDateOf } from "../domain/business-date.js";
import { newAccrualEntry } from "../domain/commission-entry.entity.js";
import {
  resolveCommissionRule,
  type CommissionResolution,
} from "../domain/resolve-commission-rule.js";
import type {
  BookingCommissionFacts,
  OrderCommissionFacts,
  OrderCommissionLine,
} from "./ports/commission-ports.js";
import {
  NOTHING_DONE,
  addResults,
  publishRecorded,
  snapshotOf,
  type AccrualDependencies,
  type AccrualResult,
  type CommissionEventContext,
} from "./accrual-shared.js";
import { reconcileSource } from "./reconcile-sources.js";

export type {
  AccrualDependencies,
  AccrualResult,
  CommissionEventContext,
} from "./accrual-shared.js";
export { reconcilePaymentSources } from "./reconcile-sources.js";

/** One thing that earns commission: a booking, or one performed line of an order. */
interface AccrualSource {
  readonly sourceType: CommissionSourceType;
  readonly sourceId: string;
  readonly sourceLineId: string | null;
  readonly sourceNumber: string | null;
  readonly memberId: string;
  readonly locationId: string;
  readonly offeringId: string;
  readonly quantity: number;
  /** The price after discount, without tax (owner decision). */
  readonly base: Money;
  /** What a refund is measured against: the booking's total, or the order's grand total. */
  readonly sourceGrossTotal: Money;
  /** The ids a log line names, so an operator can find the source. */
  readonly logFields: Readonly<Record<string, string>>;
}

async function resolveSourceRule(
  dependencies: AccrualDependencies,
  source: AccrualSource,
): Promise<CommissionResolution | undefined> {
  const offering = await dependencies.offerings.readOffering(source.offeringId);
  if (offering === undefined) return undefined;
  const roleIds = await dependencies.memberRoles.roleIdsAt(source.memberId, source.locationId);
  const rules = await dependencies.rules.listActiveForSubjects({
    memberId: source.memberId,
    roleIds,
  });
  return resolveCommissionRule(
    {
      memberId: source.memberId,
      roleIds,
      offeringId: source.offeringId,
      offeringKind: offering.kind,
      categoryIds: offering.categoryIds,
      base: source.base,
      quantity: source.quantity,
    },
    rules,
  );
}

function logUnresolvedRule(
  dependencies: AccrualDependencies,
  source: AccrualSource,
  resolution: CommissionResolution,
): AccrualResult | undefined {
  if (resolution.outcome === "NO_RULE") {
    dependencies.logger.debug(source.logFields, "commission.no_rule");
    return NOTHING_DONE;
  }
  if (resolution.outcome === "CURRENCY_MISMATCH") {
    dependencies.logger.warn(
      { ...source.logFields, commissionRuleId: resolution.commissionRuleId },
      "commission.accrual_skipped_currency",
    );
    return { ...NOTHING_DONE, skippedCurrency: 1 };
  }
  return undefined;
}

/**
 * Writes the ACCRUAL of one source when a rule matches. A replay finds the accrual already there
 * (the unique sequence 1 per source and member) and writes nothing. Runs inside the caller's
 * transaction.
 */
async function accrueSource(
  dependencies: AccrualDependencies,
  source: AccrualSource,
  context: CommissionEventContext,
): Promise<AccrualResult> {
  const resolution = await resolveSourceRule(dependencies, source);
  if (resolution === undefined) return NOTHING_DONE;
  const skipped = logUnresolvedRule(dependencies, source, resolution);
  if (skipped !== undefined) return skipped;
  if (resolution.outcome !== "MATCHED") return NOTHING_DONE;
  const timeZone = await dependencies.timezones.read(context.organizationId);
  const entry = newAccrualEntry({
    organizationId: context.organizationId,
    memberId: asId<MemberId>(source.memberId),
    locationId: asId<LocationId>(source.locationId),
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    sourceLineId: source.sourceLineId,
    sourceNumber: source.sourceNumber,
    amount: resolution.amount,
    base: source.base,
    sourceGrossTotal: source.sourceGrossTotal,
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

type ProvidedBooking = BookingCommissionFacts & { readonly providerMemberId: string };

function accrualSourceOfBooking(booking: ProvidedBooking): AccrualSource {
  return {
    sourceType: COMMISSION_SOURCE_TYPE.BOOKING,
    sourceId: booking.bookingId,
    sourceLineId: null,
    sourceNumber: booking.bookingNumber,
    memberId: booking.providerMemberId,
    locationId: booking.locationId,
    offeringId: booking.offeringId,
    quantity: booking.quantity,
    base: {
      amount: booking.price.total.amount - booking.price.tax.amount,
      currency: booking.price.currency,
    },
    sourceGrossTotal: booking.price.total,
    logFields: { bookingId: booking.bookingId },
  };
}

/** A performed line earns on its net amount without tax; the refund ratio uses the whole order (ADR-135). */
function accrualSourceOfLine(
  order: OrderCommissionFacts,
  line: OrderCommissionLine,
  memberId: string,
): AccrualSource {
  return {
    sourceType: COMMISSION_SOURCE_TYPE.ORDER_LINE,
    sourceId: order.orderId,
    sourceLineId: line.orderLineId,
    sourceNumber: order.orderNumber,
    memberId,
    locationId: order.locationId,
    offeringId: line.offeringId,
    quantity: line.quantity,
    base: {
      amount: line.lineNetTotal.amount - line.lineTax.amount,
      currency: line.lineNetTotal.currency,
    },
    sourceGrossTotal: order.grandTotal,
    logFields: { orderId: order.orderId, orderLineId: line.orderLineId },
  };
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
    // A replay finds the accrual already written and goes straight to reconcile.
    const accrued = await accrueSource(
      dependencies,
      accrualSourceOfBooking({ ...booking, providerMemberId: booking.providerMemberId }),
      input.context,
    );
    const reconciled = await reconcileSource(
      dependencies,
      { sourceType: COMMISSION_SOURCE_TYPE.BOOKING, sourceId: input.bookingId },
      input.context,
    );
    return addResults(accrued, reconciled);
  });
}

/**
 * `sales.order.completed`: one accrual per performed line (plan 3.11 Refresh C). Each line has its
 * own unique sequence 1, so a replay writes nothing. A line without a performer earns nothing.
 */
export async function accrueCompletedOrder(
  dependencies: AccrualDependencies,
  input: { readonly orderId: string; readonly context: CommissionEventContext },
): Promise<AccrualResult> {
  return dependencies.unitOfWork.run(async () => {
    await dependencies.marks.touch(COMMISSION_SOURCE_TYPE.ORDER_LINE, input.orderId);
    const order = await dependencies.orders.readOrder(input.orderId);
    if (order === undefined || order.status !== ORDER_STATUS.COMPLETED) return NOTHING_DONE;
    const accrued = await accrueOrderLines(dependencies, order, input.context);
    const reconciled = await reconcileSource(
      dependencies,
      { sourceType: COMMISSION_SOURCE_TYPE.ORDER_LINE, sourceId: input.orderId },
      input.context,
    );
    return addResults(accrued, reconciled);
  });
}

async function accrueOrderLines(
  dependencies: AccrualDependencies,
  order: OrderCommissionFacts,
  context: CommissionEventContext,
): Promise<AccrualResult> {
  let result = NOTHING_DONE;
  for (const line of order.lines) {
    if (line.performedByMemberId === null) continue;
    const source = accrualSourceOfLine(order, line, line.performedByMemberId);
    result = addResults(result, await accrueSource(dependencies, source, context));
  }
  return result;
}
