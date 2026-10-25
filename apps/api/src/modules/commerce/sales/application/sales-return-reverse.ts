import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ERROR_CODE } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  ORDER_STATUS,
  orderApprovalSubject,
  SALES_EVENT_TYPE,
  SALES_RETURN_REVERSE_REASON,
  SALES_RETURN_STATUS,
  SALES_RULE_KEY,
  type SalesReturnResponse,
} from "@banijjik/contracts/sales";
import type { OrganizationId, SalesReturnId, UserId } from "@banijjik/ids";
import type { SalesReturnReverseRequestBody } from "@banijjik/validation/sales";
import { businessDateOf } from "../domain/business-date.js";
import { DomainRuleError, recordNotFound, salesRuleError } from "../domain/errors.js";
import type { Order } from "../domain/order.entity.js";
import { otherReasonNeedsNote, returnApprovalRequired } from "../domain/sales-return-errors.js";
import type { SalesReturnRecord } from "../domain/sales-return.record.js";
import type { SalesReturnDependencies } from "./sales-return-dependencies.js";
import { requireActor } from "./sales-return-prepare.js";
import { toSalesReturnResponse } from "./sales-return-views.js";
import { assertLocationAllowed } from "./sales-transition-shared.js";

export interface ReverseSalesReturnInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly actorUserId: UserId | null;
  readonly salesReturnId: SalesReturnId;
  readonly body: SalesReturnReverseRequestBody;
}

interface ReverseContext {
  readonly record: SalesReturnRecord;
  readonly order: Order;
  readonly approval: Awaited<ReturnType<SalesReturnDependencies["approvals"]["consume"]>>;
  readonly actorUserId: UserId;
}

/** Stock, money, order lines and the return row move together or not at all (plan 3.5b R4 to R6). */
export class ReverseSalesReturnUseCase {
  constructor(private readonly dependencies: SalesReturnDependencies) {}

  async execute(input: ReverseSalesReturnInput): Promise<SalesReturnResponse> {
    const actorUserId = requireActor(input.actorUserId);
    return this.dependencies.unitOfWork.run(async () => {
      const context = await loadReverseContext(this.dependencies, input, actorUserId);
      const paybackPaymentId = await reverseStockAndMoney(this.dependencies, input, context);
      const reversed = await saveReversedReturn({
        dependencies: this.dependencies,
        input,
        context,
        paybackPaymentId,
      });
      await publishReversal(this.dependencies, reversed, actorUserId);
      return toSalesReturnResponse(reversed);
    });
  }
}

function assertReversible(record: SalesReturnRecord, order: Order): void {
  if (record.status !== SALES_RETURN_STATUS.ACTIVE) {
    throw new DomainRuleError({ code: ERROR_CODE.CONFLICT });
  }
  if (record.exchangeOrderId !== null) {
    throw salesRuleError(SALES_RULE_KEY.SALES_RETURN_EXCHANGE_NOT_REVERSIBLE);
  }
  if (order.status !== ORDER_STATUS.COMPLETED) {
    throw salesRuleError(SALES_RULE_KEY.SALES_RETURN_REVERSE_ORDER_NOT_COMPLETED);
  }
}

function assertReasonHasNote(body: SalesReturnReverseRequestBody): void {
  if (body.reasonKey !== SALES_RETURN_REVERSE_REASON.OTHER) return;
  if (body.note === undefined || body.note === null || body.note.length === 0) {
    throw otherReasonNeedsNote();
  }
}

async function loadReverseContext(
  dependencies: SalesReturnDependencies,
  input: ReverseSalesReturnInput,
  actorUserId: UserId,
): Promise<ReverseContext> {
  assertReasonHasNote(input.body);
  const record = await dependencies.returns.findById(input.salesReturnId);
  if (record === undefined) throw recordNotFound();
  assertLocationAllowed(record.locationId, input.allowedLocationIds);
  const order = await dependencies.orders.findById(record.orderId);
  if (order === undefined) throw recordNotFound();
  assertReversible(record, order);
  const approvalToken = input.body.approvalToken;
  if (approvalToken === undefined) {
    throw returnApprovalRequired(APPROVAL_ACTION.SALES_RETURN_REVERSAL);
  }
  const approval = await dependencies.approvals.consume(approvalToken, {
    action: APPROVAL_ACTION.SALES_RETURN_REVERSAL,
    subjectKey: orderApprovalSubject(record.orderId),
    amount: record.value,
  });
  return { record, order, approval, actorUserId };
}

/** The goods must still be there to give them back, so a shortfall is a rule, not a stock error. */
function stockGoneError(error: unknown): DomainRuleError | undefined {
  if (!(error instanceof DomainRuleError) || error.code !== ERROR_CODE.INSUFFICIENT_STOCK) {
    return undefined;
  }
  return salesRuleError(SALES_RULE_KEY.SALES_RETURN_STOCK_GONE, ERROR_CODE.BUSINESS_RULE, {
    inventoryItemId: error.details?.inventoryItemId,
  });
}

async function reverseStockAndMoney(
  dependencies: SalesReturnDependencies,
  input: ReverseSalesReturnInput,
  context: ReverseContext,
): Promise<string | null> {
  try {
    await dependencies.stock.reverseReturn({
      organizationId: input.organizationId,
      locationId: context.record.locationId,
      actorUserId: context.actorUserId,
      salesReturnId: context.record.salesReturnId,
    });
  } catch (error) {
    throw stockGoneError(error) ?? error;
  }
  await dependencies.payments.restoreReturnTotal({
    organizationId: input.organizationId,
    orderId: context.record.orderId,
    currency: context.record.value.currency,
    amountMinor: context.record.value.amount,
    now: dependencies.clock.now(),
  });
  return collectPayback(dependencies, input, context);
}

async function collectPayback(
  dependencies: SalesReturnDependencies,
  input: ReverseSalesReturnInput,
  context: ReverseContext,
): Promise<string | null> {
  const { payback } = input.body;
  if (payback === undefined) return null;
  if (context.record.refund.amount.amount === 0) {
    throw new DomainRuleError({
      code: ERROR_CODE.VALIDATION_ERROR,
      details: { field: "payback" },
    });
  }
  const memberId = await dependencies.members.memberIdOf(context.actorUserId, input.organizationId);
  const payment = await dependencies.payments.receiveOrderPayment({
    organizationId: input.organizationId,
    orderId: context.record.orderId,
    locationId: context.record.locationId,
    actorUserId: context.actorUserId,
    receivedByMemberId: memberId,
    method: payback.method,
    amount: context.record.refund.amount,
    contactId: context.record.contactId,
    externalReference: payback.externalReference ?? null,
    note: input.body.note ?? null,
    now: dependencies.clock.now(),
  });
  return payment.paymentId;
}

async function saveReversedReturn(args: {
  readonly dependencies: SalesReturnDependencies;
  readonly input: ReverseSalesReturnInput;
  readonly context: ReverseContext;
  readonly paybackPaymentId: string | null;
}): Promise<SalesReturnRecord> {
  const { dependencies, input, context, paybackPaymentId } = args;
  const now = dependencies.clock.now();
  const timeZone = await dependencies.timeZone.read(input.organizationId);
  const lines = context.order.lines.map((line) => {
    const returned = context.record.lines.find((entry) => entry.orderLineId === line.orderLineId);
    if (returned === undefined) return line;
    return { ...line, returnedQuantity: line.returnedQuantity - returned.quantity };
  });
  await dependencies.orders.update(
    context.order.recordReturn({ lines, actor: { actorUserId: context.actorUserId, now } }),
    context.order.version,
  );
  return dependencies.returns.reverse({
    salesReturnId: context.record.salesReturnId,
    expectedVersion: input.body.version,
    reversal: {
      reversedAt: now,
      businessDate: businessDateOf(now, timeZone),
      reversedByUserId: context.actorUserId,
      reasonKey: input.body.reasonKey,
      note: input.body.note ?? null,
      paybackPaymentId,
      approval: {
        action: APPROVAL_ACTION.SALES_RETURN_REVERSAL,
        approvalId: context.approval.approvalTokenId,
        approverMemberId: context.approval.approverMemberId,
        approvedAt: context.approval.approvedAt,
      },
    },
  });
}

async function publishReversal(
  dependencies: SalesReturnDependencies,
  record: SalesReturnRecord,
  actorUserId: UserId,
): Promise<void> {
  await dependencies.events.publish(
    SALES_EVENT_TYPE.SALES_RETURN_REVERSED,
    { salesReturnId: record.salesReturnId, orderId: record.orderId },
    { orderingKey: `order:${record.orderId}` },
  );
  await dependencies.audit.record({
    action: AUDIT_ACTION.SALES_RETURN_REVERSED,
    entityType: AUDIT_ENTITY_TYPE.salesReturn,
    entityId: record.salesReturnId,
    changes: { actorUserId: { to: actorUserId } },
  });
}
