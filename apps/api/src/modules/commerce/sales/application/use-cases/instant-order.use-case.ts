import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, LIMIT_KEY, SEQUENCE_KEY } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/pricing";
import {
  FULFILLMENT_METHOD,
  ORDER_SOURCE,
  SALES_EVENT_TYPE,
  type OrderResponse,
  type OrderSource,
} from "@banijjik/contracts/sales";
import {
  asId,
  newId,
  type ContactId,
  type LocationId,
  type OrderId,
  type UserId,
} from "@banijjik/ids";
import { nextSequenceValue } from "../../../../../kernel/sequence/index.js";
import { businessDateOf, businessMonthKeyOf } from "../../domain/business-date.js";
import { Order } from "../../domain/order.entity.js";
import type { SalesSettings } from "../ports/sales-ports.js";
import { resolveApproval } from "../sales-approval.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import type { OrderLineInput, PreparedLines } from "../sales-line-preparation.js";
import { quoteAndPrepare } from "../sales-quote-lines.js";
import {
  assertLocationAllowed,
  formatInvoiceNumber,
  formatOrderNumber,
  orderOrderingKey,
  resolveFulfillmentMethod,
  stockInputOf,
} from "../sales-transition-shared.js";
import { toOrderResponse } from "../sales-views.js";
import {
  assertActiveContact,
  type OrderBodyBase,
  type OrderWriteInput,
} from "./create-order.use-case.js";

/**
 * `POST /orders/instant` (decision 5): a counter sale that creates, places and completes the order
 * inside one transaction. Both numbers are taken here — the gapless INVOICE sequence is safe only
 * inside a transaction — and the stock reservation is committed to sale movements in the same
 * unit of work. Any failure rolls all of it back.
 */

/** Everything the transaction needs, gathered before the unit of work opens. */
export interface PreparedInstantSale {
  readonly organizationId: OrderWriteInput["organizationId"];
  readonly actorUserId: UserId;
  readonly locationId: string;
  readonly contactId: ContactId | null;
  readonly body: OrderBodyBase & { readonly lines: readonly OrderLineInput[] };
  readonly now: Date;
  readonly timeZone: string;
  readonly settings: SalesSettings;
  readonly prepared: PreparedLines;
  readonly ownerExempt: boolean;
  readonly source: OrderSource;
  /** What the customer owes for these lines, known before the transaction so the caller can check the tender. */
  readonly grandTotal: Money;
}

export interface InstantSaleInput extends OrderWriteInput {
  readonly actorUserId: UserId;
  readonly body: OrderBodyBase & { readonly lines: readonly OrderLineInput[] };
  /** Where the sale was rung up; the admin route leaves it out and gets ADMIN. */
  readonly source?: OrderSource;
}

export class InstantOrderUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: InstantSaleInput): Promise<OrderResponse> {
    const prepared = await this.prepare(input);
    const order = await this.dependencies.unitOfWork.run(() => this.commit(prepared));
    return toOrderResponse(order, await this.dependencies.payments.readTotals(order.orderId));
  }

  /**
   * Quote, price and check everything that needs no transaction. The POS reads the grand total
   * from it before it opens its own unit of work, so the tender can be checked first.
   */
  async prepare(input: InstantSaleInput): Promise<PreparedInstantSale> {
    assertLocationAllowed(input.body.locationId, input.allowedLocationIds);
    const contactId =
      input.body.contactId === undefined ? null : asId<ContactId>(input.body.contactId);
    await assertActiveContact(this.dependencies, contactId);
    const settings = await this.dependencies.settings.read(input.organizationId);
    const timeZone = await this.dependencies.timeZone.read(input.organizationId);
    const now = this.dependencies.clock.now();
    const prepared = await quoteAndPrepare(this.dependencies, {
      organizationId: input.organizationId,
      locationId: input.body.locationId,
      lines: input.body.lines,
      orderDiscount: input.body.orderDiscount,
    });
    const ownerExempt =
      settings.discountOwnerWithoutApproval && (await this.dependencies.owner.isOwner());
    return {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      locationId: input.body.locationId,
      contactId,
      body: input.body,
      now,
      timeZone,
      settings,
      prepared,
      ownerExempt,
      source: input.source ?? ORDER_SOURCE.ADMIN,
      grandTotal: prepared.totals.grandTotal,
    };
  }

  /** Writes the order, its stock movements and its summary. It must run inside a unit of work. */
  async commit(ctx: PreparedInstantSale): Promise<Order> {
    const approval = await resolveApproval({
      approvalsRequired: ctx.prepared.approvalsRequired,
      orderId: null,
      instant: true,
      ownerExempt: ctx.ownerExempt,
      approvalToken: ctx.body.approvalToken,
      amount: ctx.prepared.manualDiscountTotal,
      approvals: this.dependencies.approvals,
    });
    const counted =
      (await this.dependencies.counter.increment(businessMonthKeyOf(ctx.now, ctx.timeZone))) - 1;
    await this.dependencies.limits.assertBelow(LIMIT_KEY.ORDERS_PER_MONTH, counted);
    const orderNumber = formatOrderNumber(
      await nextSequenceValue({
        organizationId: ctx.organizationId,
        sequenceKey: SEQUENCE_KEY.ORDER,
      }),
    );
    const invoiceNumber = formatInvoiceNumber(
      await nextSequenceValue({
        organizationId: ctx.organizationId,
        sequenceKey: SEQUENCE_KEY.INVOICE,
      }),
    );
    const placed = this.placeDraft(ctx, orderNumber, approval);
    const unitCosts = await this.settleStock(ctx, placed.orderId);
    const completed = placed.completeInstant({
      invoiceNumber,
      unitCosts,
      actor: { actorUserId: ctx.actorUserId, now: ctx.now },
    });
    await this.dependencies.orders.insert(completed);
    await this.dependencies.payments.initializeSummary({
      organizationId: ctx.organizationId,
      orderId: completed.orderId,
      contactId: completed.contactId,
      locationId: completed.locationId,
      total: completed.totals.grandTotal,
      now: ctx.now,
    });
    await this.dependencies.payments.updateTotal({
      organizationId: ctx.organizationId,
      orderId: completed.orderId,
      total: completed.totals.grandTotal,
      now: ctx.now,
    });
    await this.publishAndAudit(ctx, completed);
    return completed;
  }

  private placeDraft(
    ctx: PreparedInstantSale,
    orderNumber: string,
    approval: Order["approval"],
  ): Order {
    return Order.createDraft({
      orderId: newId<OrderId>(),
      organizationId: ctx.organizationId,
      locationId: asId<LocationId>(ctx.locationId),
      contactId: ctx.contactId,
      fulfillment: {
        method: resolveFulfillmentMethod(ctx.body.fulfillmentMethod, FULFILLMENT_METHOD.INSTANT),
      },
      lines: ctx.prepared.lines,
      totals: ctx.prepared.totals,
      businessDate: businessDateOf(ctx.now, ctx.timeZone),
      source: ctx.source,
      note: ctx.body.note ?? null,
      orderDiscount: ctx.body.orderDiscount ?? null,
      customFields: ctx.body.customFields ?? {},
      hasStockLines: ctx.prepared.trackedLines.length > 0,
      createdByUserId: ctx.actorUserId,
      now: ctx.now,
    }).place({
      orderNumber,
      contactId: ctx.contactId,
      lines: ctx.prepared.lines,
      totals: ctx.prepared.totals,
      approval,
      hasStockLines: ctx.prepared.trackedLines.length > 0,
      actor: { actorUserId: ctx.actorUserId, now: ctx.now },
    });
  }

  /**
   * Reserve tracked lines, read the frozen cost components, then commit the sale — all inside the
   * same transaction. The costs must be read before `commitSale` consumes the reservation so that
   * the level's average cost is captured at commit time (ADR-125).
   */
  private async settleStock(
    ctx: PreparedInstantSale,
    orderId: OrderId,
  ): Promise<ReadonlyMap<string, Money | null>> {
    const stockInput = stockInputOf({
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      actorUserId: ctx.actorUserId,
      orderId,
      lines: ctx.prepared.trackedLines,
      allowNegativeStock: ctx.settings.allowNegativeStock,
    });
    if (ctx.prepared.trackedLines.length === 0) {
      return this.dependencies.unitCosts.read({
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
        lines: ctx.prepared.costLines,
      });
    }
    await this.dependencies.stock.reserve(stockInput);
    const unitCosts = await this.dependencies.unitCosts.read({
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      lines: ctx.prepared.costLines,
    });
    await this.dependencies.stock.commitSale({ ...stockInput, actorUserId: ctx.actorUserId });
    return unitCosts;
  }

  private async publishAndAudit(ctx: PreparedInstantSale, order: Order): Promise<void> {
    await this.dependencies.events.publish(
      SALES_EVENT_TYPE.ORDER_PLACED,
      { orderId: order.orderId },
      { orderingKey: orderOrderingKey(order.orderId) },
    );
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.ORDER_PLACED,
      entityType: AUDIT_ENTITY_TYPE.order,
      entityId: order.orderId,
      changes: { orderNumber: { to: order.orderNumber } },
    });
    await this.dependencies.events.publish(
      SALES_EVENT_TYPE.ORDER_COMPLETED,
      { orderId: order.orderId },
      { orderingKey: orderOrderingKey(order.orderId) },
    );
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.ORDER_COMPLETED,
      entityType: AUDIT_ENTITY_TYPE.order,
      entityId: order.orderId,
      changes: { invoiceNumber: { to: order.invoiceNumber } },
    });
  }
}
