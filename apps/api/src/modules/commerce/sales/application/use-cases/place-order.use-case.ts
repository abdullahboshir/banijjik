import { OFFERING_KIND } from "@banijjik/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, LIMIT_KEY, SEQUENCE_KEY } from "@banijjik/contracts";
import {
  FULFILLMENT_METHOD,
  ORDER_STATUS,
  SALES_ADVANCE_REQUIRED,
  SALES_EVENT_TYPE,
  type OrderResponse,
} from "@banijjik/contracts/sales";
import type { ContactId, OrderId } from "@banijjik/ids";
import { nextSequenceValue } from "../../../../../kernel/sequence/index.js";
import { businessMonthKeyOf } from "../../domain/business-date.js";
import {
  contactPhoneRequired,
  invalidTransition,
  orderNeedsLine,
  recordNotFound,
} from "../../domain/errors.js";
import { Order } from "../../domain/order.entity.js";
import type { OrderTransitionActor } from "../../domain/order-types.js";
import type { SalesSettings } from "../ports/sales-ports.js";
import { resolveApproval } from "../sales-approval.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import type { PreparedLines } from "../sales-line-preparation.js";
import { quoteAndPrepare } from "../sales-quote-lines.js";
import {
  assertLocationAllowed,
  formatOrderNumber,
  orderOrderingKey,
  stockInputOf,
} from "../sales-transition-shared.js";
import { toOrderResponse } from "../sales-views.js";
import { lineInputsOf, type OrderWriteInput } from "./create-order.use-case.js";

interface PlaceInput extends OrderWriteInput {
  readonly orderId: OrderId;
  readonly body: { readonly version: number; readonly approvalToken?: string | undefined };
}

/** Everything the place transaction needs, gathered before the unit of work opens. */
interface PlaceContext {
  readonly draft: Order;
  readonly input: PlaceInput;
  readonly prepared: PreparedLines;
  readonly settings: SalesSettings;
  readonly timeZone: string;
  readonly now: Date;
  readonly ownerExempt: boolean;
}

/**
 * DRAFT becomes PLACED inside one transaction: the approval token is consumed, the monthly
 * counter is incremented and checked, the ORDER number is taken, the stock is reserved and the
 * event and audit entry are written. Any failure rolls all of it back (the FAST sequence number
 * may be lost, which the sequence rules allow).
 */
export class PlaceOrderUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: PlaceInput): Promise<OrderResponse> {
    const ctx = await this.buildContext(input);
    const placed = await this.dependencies.unitOfWork.run(() => this.inTransaction(ctx));
    return toOrderResponse(placed, await this.dependencies.payments.readTotals(placed.orderId));
  }

  private async buildContext(input: PlaceInput): Promise<PlaceContext> {
    const draft = await this.dependencies.orders.findById(input.orderId);
    if (draft === undefined) throw recordNotFound();
    assertLocationAllowed(draft.locationId, input.allowedLocationIds);
    if (draft.status !== ORDER_STATUS.DRAFT) throw invalidTransition(draft.status);
    const settings = await this.dependencies.settings.read(input.organizationId);
    const timeZone = await this.dependencies.timeZone.read(input.organizationId);
    const now = this.dependencies.clock.now();
    const prepared = await quoteAndPrepare(this.dependencies, {
      allowedKinds: [OFFERING_KIND.PRODUCT],
      organizationId: input.organizationId,
      locationId: draft.locationId,
      lines: lineInputsOf(draft),
      orderDiscount: draft.orderDiscount ?? undefined,
    });
    if (prepared.lines.length === 0) throw orderNeedsLine();
    if (draft.fulfillment.method === FULFILLMENT_METHOD.PICKUP) {
      if (!draft.recipient) {
        await this.assertContactWithPhone(draft.contactId);
      }
    }
    const ownerExempt =
      settings.discountOwnerWithoutApproval && (await this.dependencies.owner.isOwner());
    return { draft, input, prepared, settings, timeZone, now, ownerExempt };
  }

  private async inTransaction(ctx: PlaceContext): Promise<Order> {
    const approval = await resolveApproval({
      approvalsRequired: ctx.prepared.approvalsRequired,
      orderId: ctx.draft.orderId,
      instant: false,
      ownerExempt: ctx.ownerExempt,
      approvalToken: ctx.input.body.approvalToken,
      amount: ctx.prepared.manualDiscountTotal,
      approvals: this.dependencies.approvals,
    });
    const counted =
      (await this.dependencies.counter.increment(businessMonthKeyOf(ctx.now, ctx.timeZone))) - 1;
    await this.dependencies.limits.assertBelow(LIMIT_KEY.ORDERS_PER_MONTH, counted);
    const orderNumber = formatOrderNumber(
      await nextSequenceValue({
        organizationId: ctx.input.organizationId,
        sequenceKey: SEQUENCE_KEY.ORDER,
      }),
    );
    if (ctx.prepared.trackedLines.length > 0) {
      await this.dependencies.stock.reserve(
        stockInputOf({
          organizationId: ctx.input.organizationId,
          locationId: ctx.draft.locationId,
          actorUserId: ctx.input.actorUserId,
          orderId: ctx.draft.orderId,
          lines: ctx.prepared.trackedLines,
          allowNegativeStock: ctx.settings.allowNegativeStock,
        }),
      );
    }
    const transitioned = ctx.draft.place({
      orderNumber,
      contactId: ctx.draft.contactId,
      lines: ctx.prepared.lines,
      totals: ctx.prepared.totals,
      approval,
      hasStockLines: ctx.prepared.trackedLines.length > 0,
      actor: { actorUserId: ctx.input.actorUserId, now: ctx.now },
    });
    const persisted = await this.dependencies.orders.update(transitioned, ctx.input.body.version);
    await this.initializeSummary(ctx, persisted);
    await this.dependencies.events.publish(
      SALES_EVENT_TYPE.ORDER_PLACED,
      { orderId: persisted.orderId },
      { orderingKey: orderOrderingKey(persisted.orderId) },
    );
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.ORDER_PLACED,
      entityType: AUDIT_ENTITY_TYPE.order,
      entityId: persisted.orderId,
      changes: { orderNumber: { to: persisted.orderNumber } },
    });
    return this.maybeAutoConfirm(persisted, ctx.settings, {
      actorUserId: ctx.input.actorUserId,
      now: ctx.now,
    });
  }

  private async initializeSummary(ctx: PlaceContext, persisted: Order): Promise<void> {
    await this.dependencies.payments.initializeSummary({
      organizationId: ctx.input.organizationId,
      orderId: persisted.orderId,
      contactId: persisted.contactId,
      locationId: persisted.locationId,
      total: persisted.totals.grandTotal,
      now: ctx.now,
    });
  }

  private async assertContactWithPhone(contactId: ContactId | null): Promise<void> {
    if (contactId === null) throw contactPhoneRequired("");
    const contact = await this.dependencies.contacts.findActive(contactId);
    if (contact === undefined) throw recordNotFound();
    if (contact.phoneE164 === null) throw contactPhoneRequired(contactId);
  }

  /** Auto-confirm at place is available only when no advance rule is configured. */
  private async maybeAutoConfirm(
    order: Order,
    settings: SalesSettings,
    actor: OrderTransitionActor,
  ): Promise<Order> {
    if (!settings.autoConfirm || settings.advanceRequired !== SALES_ADVANCE_REQUIRED.NONE)
      return order;
    const persisted = await this.dependencies.orders.update(order.confirm(actor), order.version);
    await this.dependencies.events.publish(
      SALES_EVENT_TYPE.ORDER_CONFIRMED,
      { orderId: persisted.orderId },
      { orderingKey: orderOrderingKey(persisted.orderId) },
    );
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.ORDER_CONFIRMED,
      entityType: AUDIT_ENTITY_TYPE.order,
      entityId: persisted.orderId,
      changes: {},
    });
    return persisted;
  }
}
