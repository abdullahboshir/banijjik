import { AUDIT_ACTION, SEQUENCE_KEY } from "@banijjik/contracts";
import { ORDER_STATUS, SALES_EVENT_TYPE, type OrderResponse } from "@banijjik/contracts/sales";
import type { OrderId, UserId } from "@banijjik/ids";
import { nextSequenceValue } from "../../../../../kernel/sequence/index.js";
import {
  advanceNeedsPayments,
  invalidTransition,
  packingDisabled,
  recordNotFound,
} from "../../domain/errors.js";
import { Order } from "../../domain/order.entity.js";
import type { SalesSettings } from "../ports/sales-ports.js";
import type { SalesDependencies, SalesJobDependencies } from "../sales-dependencies.js";
import {
  assertLocationAllowed,
  formatInvoiceNumber,
  orderOrderingKey,
  stockInputOf,
} from "../sales-transition-shared.js";
import { toOrderResponse } from "../sales-views.js";
import type { OrderWriteInput } from "./create-order.use-case.js";

interface OrderTransitionInput {
  readonly orderId: OrderId;
  readonly body: { readonly version: number };
}

/** Shared guard for every transition: the order must exist and stay inside the caller's locations. */
async function loadTransitionOrder(
  dependencies: Pick<SalesDependencies, "orders">,
  input: OrderWriteInput & OrderTransitionInput,
): Promise<Order> {
  const order = await dependencies.orders.findById(input.orderId);
  if (order === undefined) throw recordNotFound();
  assertLocationAllowed(order.locationId, input.allowedLocationIds);
  return order;
}

/** PLACED becomes CONFIRMED; an advance rule that card 3.8 will enforce blocks the confirm. */
export class ConfirmOrderUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(
    input: OrderWriteInput & OrderTransitionInput & { readonly actorUserId: UserId },
  ): Promise<OrderResponse> {
    const order = await loadTransitionOrder(this.dependencies, input);
    if (order.status !== ORDER_STATUS.PLACED) throw invalidTransition(order.status);
    const settings = await this.dependencies.settings.read(input.organizationId);
    if (settings.advanceRequired !== "NONE") throw advanceNeedsPayments();
    const now = this.dependencies.clock.now();
    const confirmed = await this.dependencies.unitOfWork.run(async () => {
      const persisted = await this.dependencies.orders.update(
        order.confirm({ actorUserId: input.actorUserId, now }),
        input.body.version,
      );
      await this.dependencies.events.publish(
        SALES_EVENT_TYPE.ORDER_CONFIRMED,
        { orderId: persisted.orderId },
        { orderingKey: orderOrderingKey(persisted.orderId) },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ORDER_CONFIRMED,
        entityType: "order",
        entityId: persisted.orderId,
        changes: {},
      });
      return persisted;
    });
    return toOrderResponse(confirmed, await this.dependencies.payments.read(confirmed.orderId));
  }
}

/** CONFIRMED becomes PACKED when the organization uses packing (plan 3.5a transition table). */
export class PackOrderUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(
    input: OrderWriteInput & OrderTransitionInput & { readonly actorUserId: UserId },
  ): Promise<OrderResponse> {
    const order = await loadTransitionOrder(this.dependencies, input);
    if (order.status !== ORDER_STATUS.CONFIRMED) throw invalidTransition(order.status);
    const settings = await this.dependencies.settings.read(input.organizationId);
    if (!settings.usePacking) throw packingDisabled();
    const now = this.dependencies.clock.now();
    const packed = await this.dependencies.unitOfWork.run(async () => {
      const persisted = await this.dependencies.orders.update(
        order.pack({ actorUserId: input.actorUserId, now }),
        input.body.version,
      );
      await this.dependencies.events.publish(
        SALES_EVENT_TYPE.ORDER_PACKED,
        { orderId: persisted.orderId },
        { orderingKey: orderOrderingKey(persisted.orderId) },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ORDER_PACKED,
        entityType: "order",
        entityId: persisted.orderId,
        changes: {},
      });
      return persisted;
    });
    return toOrderResponse(packed, await this.dependencies.payments.read(packed.orderId));
  }
}

/**
 * CONFIRMED or PACKED becomes COMPLETED: the gapless INVOICE number is taken inside the
 * transaction, the average cost of every line is read from inventory now and the stock
 * reservation becomes SALE movements (only when a reservation exists).
 */
export class CompleteOrderUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(
    input: OrderWriteInput & OrderTransitionInput & { readonly actorUserId: UserId },
  ): Promise<OrderResponse> {
    const order = await loadTransitionOrder(this.dependencies, input);
    if (order.status !== ORDER_STATUS.CONFIRMED && order.status !== ORDER_STATUS.PACKED) {
      throw invalidTransition(order.status);
    }
    const settings = await this.dependencies.settings.read(input.organizationId);
    const now = this.dependencies.clock.now();
    const completed = await this.dependencies.unitOfWork.run(() =>
      this.completeInTransaction({ order, input, settings, now }),
    );
    return toOrderResponse(completed, await this.dependencies.payments.read(completed.orderId));
  }

  private async completeInTransaction(args: {
    readonly order: Order;
    readonly input: OrderWriteInput & OrderTransitionInput & { readonly actorUserId: UserId };
    readonly settings: SalesSettings;
    readonly now: Date;
  }): Promise<Order> {
    const { order, input, settings, now } = args;
    const invoiceNumber = formatInvoiceNumber(
      await nextSequenceValue({
        organizationId: input.organizationId,
        sequenceKey: SEQUENCE_KEY.INVOICE,
      }),
    );
    const unitCosts = await this.dependencies.unitCosts.read({
      organizationId: input.organizationId,
      locationId: order.locationId,
      lines: order.lines.map((line) => ({
        offeringId: line.offeringId,
        variantId: line.variantId,
        stockComponents: line.costComponents,
      })),
    });
    if (order.hasStockLines) {
      await this.dependencies.stock.commitSale({
        ...stockInputOf({
          organizationId: input.organizationId,
          locationId: order.locationId,
          actorUserId: input.actorUserId,
          orderId: order.orderId,
          lines: order.lines,
          allowNegativeStock: settings.allowNegativeStock,
        }),
        actorUserId: input.actorUserId,
      });
    }
    const persisted = await this.dependencies.orders.update(
      order.complete({
        invoiceNumber,
        unitCosts,
        actor: { actorUserId: input.actorUserId, now },
      }),
      input.body.version,
    );
    await this.dependencies.events.publish(
      SALES_EVENT_TYPE.ORDER_COMPLETED,
      { orderId: persisted.orderId },
      { orderingKey: orderOrderingKey(persisted.orderId) },
    );
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.ORDER_COMPLETED,
      entityType: "order",
      entityId: persisted.orderId,
      changes: { invoiceNumber: { to: persisted.invoiceNumber } },
    });
    return persisted;
  }
}

/**
 * A cancellable order becomes CANCELLED with a reason; a held reservation is released unless the
 * order never reached place (a DRAFT has no reservation). Jobs call this with a null actor.
 */
export class CancelOrderUseCase {
  constructor(private readonly dependencies: SalesJobDependencies) {}

  async execute(
    input: OrderWriteInput &
      OrderTransitionInput & { readonly reason: string; readonly actorUserId: UserId | null },
  ): Promise<OrderResponse> {
    const order = await loadTransitionOrder(this.dependencies, input);
    const settings = await this.dependencies.settings.read(input.organizationId);
    const now = this.dependencies.clock.now();
    const cancelled = await this.dependencies.unitOfWork.run(async () => {
      if (order.hasStockLines && order.status !== ORDER_STATUS.DRAFT) {
        await this.dependencies.stock.release(
          stockInputOf({
            organizationId: input.organizationId,
            locationId: order.locationId,
            actorUserId: input.actorUserId,
            orderId: order.orderId,
            lines: order.lines,
            allowNegativeStock: settings.allowNegativeStock,
          }),
        );
      }
      const persisted = await this.dependencies.orders.update(
        order.cancel({ reason: input.reason, actor: { actorUserId: input.actorUserId, now } }),
        input.body.version,
      );
      await this.dependencies.events.publish(
        SALES_EVENT_TYPE.ORDER_CANCELLED,
        { orderId: persisted.orderId },
        { orderingKey: orderOrderingKey(persisted.orderId) },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ORDER_CANCELLED,
        entityType: "order",
        entityId: persisted.orderId,
        changes: { cancelReason: { to: input.reason } },
      });
      return persisted;
    });
    return toOrderResponse(cancelled, await this.dependencies.payments.read(cancelled.orderId));
  }
}
