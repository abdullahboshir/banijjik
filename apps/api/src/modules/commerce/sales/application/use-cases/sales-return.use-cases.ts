import {
  type SalesReturnListItem,
  type SalesReturnPreviewResponse,
  type SalesReturnResponse,
} from "@banijjik/contracts/sales";
import type { OrderId, OrganizationId, SalesReturnId } from "@banijjik/ids";
import type { SalesReturnRequestBody } from "@banijjik/validation/sales";
import type { SalesReturnReverseRequestBody } from "@banijjik/validation/sales";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ERROR_CODE } from "@banijjik/contracts";
import { SALES_EVENT_TYPE } from "@banijjik/contracts/sales";
import { ORDER_STATUS } from "@banijjik/contracts/sales";
import type { UserId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import type { SalesReturnListFilter, SalesReturnPage } from "../ports/sales-return-ports.js";
import { writeSalesReturn } from "../sales-return-create.js";
import type { SalesReturnDependencies } from "../sales-return-dependencies.js";
import {
  prepareSalesReturn,
  requireActor,
  type SalesReturnCallerInput,
} from "../sales-return-prepare.js";
import {
  toSalesReturnListItem,
  toSalesReturnPreview,
  toSalesReturnResponse,
} from "../sales-return-views.js";
import { assertLocationAllowed } from "../sales-transition-shared.js";
import { orderApprovalSubject } from "@banijjik/contracts/sales";
import { SALES_RULE_KEY } from "@banijjik/contracts/sales";
import { DomainRuleError, salesRuleError } from "../../domain/errors.js";

export type SalesReturnWriteInput = SalesReturnCallerInput & {
  readonly orderId: OrderId;
  readonly body: SalesReturnRequestBody;
};

export class PreviewSalesReturnUseCase {
  constructor(private readonly dependencies: SalesReturnDependencies) {}

  async execute(input: SalesReturnWriteInput): Promise<SalesReturnPreviewResponse> {
    return toSalesReturnPreview(await prepareSalesReturn(this.dependencies, input));
  }
}

export class CreateSalesReturnUseCase {
  constructor(private readonly dependencies: SalesReturnDependencies) {}

  async execute(input: SalesReturnWriteInput): Promise<SalesReturnResponse> {
    const actorUserId = requireActor(input.actorUserId);
    return this.dependencies.unitOfWork.run(async () => {
      const prepared = await prepareSalesReturn(this.dependencies, input);
      const record = await writeSalesReturn({
        deps: this.dependencies,
        input,
        prepared,
        actorUserId,
      });
      return toSalesReturnResponse(record);
    });
  }
}

export interface SalesReturnListInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly locationId?: string | undefined;
  readonly orderId?: OrderId | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly page: number;
  readonly limit: number;
}

export class ListSalesReturnsUseCase {
  constructor(private readonly dependencies: SalesReturnDependencies) {}

  async execute(
    input: SalesReturnListInput,
  ): Promise<{ readonly items: readonly SalesReturnListItem[]; readonly hasNext: boolean }> {
    if (input.locationId !== undefined) {
      assertLocationAllowed(input.locationId, input.allowedLocationIds);
    }
    const filter: SalesReturnListFilter = {
      locationIds: input.locationId === undefined ? input.allowedLocationIds : [input.locationId],
      ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
      ...(input.from === undefined ? {} : { from: input.from }),
      ...(input.to === undefined ? {} : { to: input.to }),
      page: input.page,
      limit: input.limit,
    };
    const page: SalesReturnPage = await this.dependencies.returns.list(filter);
    return { items: page.items.map(toSalesReturnListItem), hasNext: page.hasNext };
  }
}

export class GetSalesReturnUseCase {
  constructor(private readonly dependencies: SalesReturnDependencies) {}

  async execute(input: {
    readonly salesReturnId: SalesReturnId;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<SalesReturnResponse> {
    const record = await this.dependencies.returns.findById(input.salesReturnId);
    if (record === undefined) throw recordNotFound();
    assertLocationAllowed(record.locationId, input.allowedLocationIds);
    return toSalesReturnResponse(record);
  }
}

export class ReverseSalesReturnUseCase {
  constructor(private readonly dependencies: SalesReturnDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly actorUserId: UserId;
    readonly salesReturnId: SalesReturnId;
    readonly body: SalesReturnReverseRequestBody;
  }): Promise<SalesReturnResponse> {
    return this.dependencies.unitOfWork.run(() =>
      reverseReturnInTransaction(this.dependencies, input),
    );
  }
}

type ReverseInput = Parameters<ReverseSalesReturnUseCase["execute"]>[0];
type ReverseContext = {
  readonly record: NonNullable<Awaited<ReturnType<SalesReturnDependencies["returns"]["findById"]>>>;
  readonly order: NonNullable<Awaited<ReturnType<SalesReturnDependencies["orders"]["findById"]>>>;
  readonly approval: Awaited<ReturnType<SalesReturnDependencies["approvals"]["consume"]>>;
};

async function reverseReturnInTransaction(
  dependencies: SalesReturnDependencies,
  input: ReverseInput,
): Promise<SalesReturnResponse> {
  const context = await loadReverseContext(dependencies, input);
  const paybackPaymentId = await reverseStockAndMoney(dependencies, input, context);
  const reversed = await saveReversedReturn({ dependencies, input, context, paybackPaymentId });
  await publishReversal(dependencies, reversed, input.actorUserId);
  return toSalesReturnResponse(reversed);
}

async function loadReverseContext(
  dependencies: SalesReturnDependencies,
  input: ReverseInput,
): Promise<ReverseContext> {
  const record = await dependencies.returns.findById(input.salesReturnId);
  if (record === undefined) throw recordNotFound();
  assertLocationAllowed(record.locationId, input.allowedLocationIds);
  if (record.status !== "ACTIVE") throw new DomainRuleError({ code: ERROR_CODE.CONFLICT });
  if (record.exchangeOrderId !== null)
    throw salesRuleError(SALES_RULE_KEY.SALES_RETURN_EXCHANGE_NOT_REVERSIBLE);
  const order = await dependencies.orders.findById(record.orderId);
  if (order === undefined) throw recordNotFound();
  if (order.status !== ORDER_STATUS.COMPLETED) {
    throw salesRuleError(SALES_RULE_KEY.SALES_RETURN_REVERSE_ORDER_NOT_COMPLETED);
  }
  const approval = await dependencies.approvals.consume(input.body.approvalToken, {
    action: APPROVAL_ACTION.SALES_RETURN_REVERSAL,
    subjectKey: orderApprovalSubject(record.orderId),
    amount: record.value,
  });
  return { record, order, approval };
}

async function reverseStockAndMoney(
  dependencies: SalesReturnDependencies,
  input: ReverseInput,
  context: ReverseContext,
): Promise<string | null> {
  try {
    await dependencies.stock.reverseReturn({
      organizationId: input.organizationId,
      locationId: context.record.locationId,
      actorUserId: input.actorUserId,
      salesReturnId: context.record.salesReturnId,
    });
  } catch (error) {
    if (error instanceof DomainRuleError && error.code === ERROR_CODE.INSUFFICIENT_STOCK) {
      throw salesRuleError(SALES_RULE_KEY.SALES_RETURN_STOCK_GONE, ERROR_CODE.BUSINESS_RULE, {
        inventoryItemId: error.details?.inventoryItemId,
      });
    }
    throw error;
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
  input: ReverseInput,
  context: ReverseContext,
): Promise<string | null> {
  if (input.body.payback === undefined) return null;
  if (context.record.refund.amount.amount === 0) {
    throw new DomainRuleError({ code: ERROR_CODE.VALIDATION_ERROR });
  }
  const memberId = await dependencies.members.memberIdOf(input.actorUserId, input.organizationId);
  return dependencies.payments.receiveReturnPayback({
    organizationId: input.organizationId,
    orderId: context.record.orderId,
    locationId: context.record.locationId,
    actorUserId: input.actorUserId,
    receivedByMemberId: memberId,
    method: input.body.payback.method,
    amount: context.record.refund.amount,
    contactId: context.record.contactId,
    externalReference: input.body.payback.externalReference ?? null,
    now: dependencies.clock.now(),
  });
}

async function saveReversedReturn(args: {
  readonly dependencies: SalesReturnDependencies;
  readonly input: ReverseInput;
  readonly context: ReverseContext;
  readonly paybackPaymentId: string | null;
}): Promise<NonNullable<ReverseContext["record"]>> {
  const { dependencies, input, context, paybackPaymentId } = args;
  const lines = context.order.lines.map((line) => {
    const returned = context.record.lines.find((entry) => entry.orderLineId === line.orderLineId);
    return returned === undefined
      ? line
      : { ...line, returnedQuantity: line.returnedQuantity - returned.quantity };
  });
  await dependencies.orders.update(
    context.order.recordReturn({
      lines,
      actor: { actorUserId: input.actorUserId, now: dependencies.clock.now() },
    }),
    context.order.version,
  );
  return dependencies.returns.reverse({
    salesReturnId: context.record.salesReturnId,
    expectedVersion: input.body.version,
    reversal: {
      reversedAt: dependencies.clock.now(),
      reversedByUserId: input.actorUserId,
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
  record: NonNullable<ReverseContext["record"]>,
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
