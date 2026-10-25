import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, SEQUENCE_KEY } from "@banijjik/contracts";
import { SALES_EVENT_TYPE } from "@banijjik/contracts/sales";
import { newId, type SalesReturnId, type UserId } from "@banijjik/ids";
import type { SalesReturnRequestBody } from "@banijjik/validation/sales";
import { nextSequenceValue } from "../../../../kernel/sequence/index.js";
import type { SalesReturnRecord, SalesReturnLineRecord } from "../domain/sales-return.record.js";
import type { SalesReturnPlan } from "../domain/sales-return-plan.js";
import type { SalesReturnDependencies } from "./sales-return-dependencies.js";
import { consumeReturnApprovals, type ConsumedReturnApprovals } from "./sales-return-approvals.js";
import { formatSalesReturnNumber } from "./sales-return-number.js";
import type { PreparedSalesReturn } from "./sales-return-prepare.js";
import { returnStockOfLines } from "./sales-return-stock.js";
import type { SalesReturnWriteInput } from "./use-cases/sales-return.use-cases.js";

/**
 * The write half of a return, run inside its transaction (plan 3.5b decisions 5 to 9): approvals,
 * stock, the payment, the order projection, the return row, then the event and the audit entry.
 */
export interface WriteSalesReturnArgs {
  readonly deps: SalesReturnDependencies;
  readonly input: SalesReturnWriteInput;
  readonly prepared: PreparedSalesReturn;
  readonly actorUserId: UserId;
}

export async function writeSalesReturn(args: WriteSalesReturnArgs): Promise<SalesReturnRecord> {
  const { deps, input, prepared, actorUserId } = args;
  const { order, plan, settlement, currency } = prepared;
  const settings = await deps.settings.read(input.organizationId);
  const memberId = await deps.members.memberIdOf(actorUserId, input.organizationId);
  const salesReturnId = newId<SalesReturnId>();
  const now = deps.clock.now();
  const approvals = await consumeReturnApprovals({
    approvals: deps.approvals,
    orderId: order.orderId,
    body: input.body,
    refundDue: { amount: settlement.refundMinor, currency },
    refundApprovalRequired: prepared.refundApprovalRequired,
    notReceivedValue: plan.notReceivedValue,
    notReceivedApprovalRequired: prepared.notReceivedApprovalRequired,
  });
  await returnStockOfLines({
    stock: deps.stock,
    organizationId: input.organizationId,
    locationId: order.locationId,
    actorUserId,
    orderId: order.orderId,
    salesReturnId,
    allowNegativeStock: settings.allowNegativeStock,
    lines: plan.lines,
  });
  const payment = await deps.payments.settleReturn({
    organizationId: input.organizationId,
    orderId: order.orderId,
    locationId: order.locationId,
    actorUserId,
    receivedByMemberId: memberId,
    currency,
    newTotalMinor: settlement.newTotalMinor,
    refund: refundRequestOf(prepared, input.body, approvals),
    now,
  });
  await deps.orders.update(
    order.recordReturn({ lines: plan.updatedLines, actor: { actorUserId, now } }),
    order.version,
  );
  const record = await buildReturnRecord({
    deps,
    input,
    prepared,
    plan,
    approvals,
    salesReturnId,
    paymentIds: { paymentId: payment.paymentId, storeCreditEntryId: payment.storeCreditEntryId },
    actorUserId,
    now,
  });
  await deps.returns.insert(record);
  await publishReturnEffects(deps, record, actorUserId);
  return record;
}

/** The refund a return asks payment for, or null when none is due (or GATEWAY, refused earlier). */
function refundRequestOf(
  prepared: PreparedSalesReturn,
  body: SalesReturnRequestBody,
  approvals: ConsumedReturnApprovals,
): Parameters<SalesReturnDependencies["payments"]["settleReturn"]>[0]["refund"] {
  const method = prepared.refundMethod;
  if (method === null || prepared.settlement.refundMinor === 0) return null;
  return {
    method,
    amountMinor: prepared.settlement.refundMinor,
    contactId: prepared.order.contactId,
    externalReference: body.refundExternalReference ?? null,
    approval: approvals.refund,
    hasRefundWithoutApprovalPermission: prepared.hasRefundWithoutApprovalPermission,
    note: body.note ?? null,
  };
}

function lineRecordsOf(plan: SalesReturnPlan): SalesReturnLineRecord[] {
  return plan.lines.map((line) => ({
    orderLineId: line.orderLineId,
    offeringId: line.offeringId,
    variantId: line.variantId,
    nameSnapshot: line.nameSnapshot,
    quantity: line.quantity,
    disposition: line.disposition,
    value: line.value,
    taxPart: line.taxPart,
  }));
}

interface ReturnRecordArgs {
  readonly deps: SalesReturnDependencies;
  readonly input: SalesReturnWriteInput;
  readonly prepared: PreparedSalesReturn;
  readonly plan: SalesReturnPlan;
  readonly approvals: ConsumedReturnApprovals;
  readonly salesReturnId: SalesReturnId;
  readonly paymentIds: {
    readonly paymentId: string | null;
    readonly storeCreditEntryId: string | null;
  };
  readonly actorUserId: UserId;
  readonly now: Date;
}

async function buildReturnRecord(args: ReturnRecordArgs): Promise<SalesReturnRecord> {
  const { prepared, plan, input } = args;
  const settlement = prepared.settlement;
  const currency = prepared.currency;
  const sequence = await nextSequenceValue({
    sequenceKey: SEQUENCE_KEY.RETURN,
    organizationId: input.organizationId,
  });
  const refundDue = settlement.refundMinor > 0 && prepared.refundMethod !== null;
  return {
    salesReturnId: args.salesReturnId,
    organizationId: input.organizationId,
    salesReturnNumber: formatSalesReturnNumber(sequence),
    orderId: prepared.order.orderId,
    locationId: prepared.order.locationId,
    contactId: prepared.order.contactId,
    lines: lineRecordsOf(plan),
    deliveryChargeReturned: plan.deliveryChargeReturned,
    roundingReturned: plan.roundingReturned,
    value: plan.value,
    refund: {
      method: refundDue ? prepared.refundMethod : null,
      amount: { amount: settlement.refundMinor, currency },
      paymentId: args.paymentIds.paymentId,
      storeCreditEntryId: args.paymentIds.storeCreditEntryId,
    },
    dueReduced: { amount: settlement.dueReducedMinor, currency },
    reasonKey: input.body.reasonKey,
    note: input.body.note ?? null,
    approvals: args.approvals.records,
    status: "ACTIVE",
    reversal: null,
    exchangeOrderId: null,
    businessDate: prepared.today,
    version: 1,
    createdAt: args.now,
    updatedAt: args.now,
    createdByUserId: args.actorUserId,
    updatedByUserId: null,
  };
}

/** The event (ordered on the order's stream) and the audit entry; both are part of the same commit. */
async function publishReturnEffects(
  deps: SalesReturnDependencies,
  record: SalesReturnRecord,
  actorUserId: UserId,
): Promise<void> {
  await deps.events.publish(
    SALES_EVENT_TYPE.SALES_RETURN_CREATED,
    { salesReturnId: record.salesReturnId, orderId: record.orderId },
    { orderingKey: `order:${record.orderId}` },
  );
  await deps.audit.record({
    action: AUDIT_ACTION.SALES_RETURN_CREATED,
    entityType: AUDIT_ENTITY_TYPE.salesReturn,
    entityId: record.salesReturnId,
    changes: {
      orderId: { to: record.orderId },
      value: { to: record.value.amount },
      actorUserId: { to: actorUserId },
    },
  });
}
