import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, type Money } from "@banijjik/contracts";
import { SALES_EVENT_TYPE, type OrderResponse } from "@banijjik/contracts/sales";
import type {
  FirstShipmentPostingFacts,
  ShipOrderRequest,
} from "@banijjik/contracts/sales/delivery";
import { newId, type OrderId, type OrganizationId, type UserId } from "@banijjik/ids";
import { DeliveryAttempt } from "../../domain/delivery-attempt.entity.js";
import { recordNotFound } from "../../domain/errors.js";
import { lineKey, type Order } from "../../domain/order.entity.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import {
  assertLocationAllowed,
  orderOrderingKey,
  stockInputOf,
} from "../sales-transition-shared.js";
import { toOrderResponse } from "../sales-views.js";

export interface ShipOrderInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly actorUserId: UserId;
  readonly orderId: OrderId;
  readonly body: ShipOrderRequest;
}

async function loadTransitionOrder(
  dependencies: Pick<SalesDependencies, "orders">,
  input: Pick<ShipOrderInput, "orderId" | "allowedLocationIds">,
): Promise<Order> {
  const order = await dependencies.orders.findById(input.orderId);
  if (order === undefined) throw recordNotFound();
  assertLocationAllowed(order.locationId, input.allowedLocationIds);
  return order;
}

async function commitStockIfNeeded(args: {
  readonly dependencies: SalesDependencies;
  readonly order: Order;
  readonly input: ShipOrderInput;
  readonly allowNegativeStock: boolean;
}): Promise<void> {
  const { dependencies, order, input, allowNegativeStock } = args;
  if (!order.hasStockLines) return;
  await dependencies.stock.commitSale({
    ...stockInputOf({
      organizationId: input.organizationId,
      locationId: order.locationId,
      actorUserId: input.actorUserId,
      orderId: order.orderId,
      lines: order.lines,
      allowNegativeStock,
    }),
    actorUserId: input.actorUserId,
  });
}

function buildPostingFacts(args: {
  readonly order: Order;
  readonly attempt: DeliveryAttempt;
  readonly unitCosts: ReadonlyMap<string, Money | null>;
  readonly netPaidAtShipment: Money;
  readonly now: Date;
}): FirstShipmentPostingFacts {
  const { order, attempt, unitCosts, netPaidAtShipment, now } = args;
  return {
    shipmentEventId: newId(),
    deliveryAttemptId: attempt.deliveryAttemptId,
    shippedAt: now,
    businessDate: order.businessDate,
    lines: order.lines.map((line) => ({
      orderLineId: line.orderLineId,
      quantity: line.quantity,
      unitCostSnapshot: unitCosts.get(lineKey(line)) ?? null,
      lineNetTotal: line.lineNetTotal,
    })),
    netRevenue: {
      amount: order.totals.subtotal.amount - order.totals.discountTotal.amount,
      currency: order.totals.grandTotal.currency,
    },
    taxTotal: order.totals.taxTotal,
    deliveryIncome: order.totals.deliveryCharge,
    netPaidAtShipment,
  };
}

async function recordShipmentSideEffects(
  dependencies: SalesDependencies,
  orderId: OrderId,
): Promise<void> {
  await dependencies.events.publish(
    SALES_EVENT_TYPE.ORDER_SHIPPED,
    { orderId },
    { orderingKey: orderOrderingKey(orderId) },
  );
  await dependencies.audit.record({
    action: AUDIT_ACTION.ORDER_SHIPPED,
    entityType: AUDIT_ENTITY_TYPE.order,
    entityId: orderId,
    changes: {},
  });
}

export class ShipOrderUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: ShipOrderInput): Promise<OrderResponse> {
    const order = await loadTransitionOrder(this.dependencies, input);
    const settings = await this.dependencies.settings.read(input.organizationId);
    const now = this.dependencies.clock.now();

    const shipped = await this.dependencies.unitOfWork.run(async () => {
      await commitStockIfNeeded({
        dependencies: this.dependencies,
        order,
        input,
        allowNegativeStock: settings.allowNegativeStock,
      });
      const unitCosts = await this.dependencies.unitCosts.read({
        organizationId: input.organizationId,
        locationId: order.locationId,
        lines: order.lines.map((line) => ({
          offeringId: line.offeringId,
          variantId: line.variantId,
          stockComponents: line.costComponents,
        })),
      });
      const netPaidAtShipment = await this.dependencies.payments.readNetPaid({
        organizationId: input.organizationId,
        orderId: order.orderId,
      });
      const attempt = DeliveryAttempt.start({
        organizationId: input.organizationId,
        orderId: order.orderId,
        ordinal: 1,
        dispatch: input.body.dispatch,
        actorUserId: input.actorUserId,
        now,
      });
      await this.dependencies.deliveryAttempts.insert(attempt);
      const firstShipment = buildPostingFacts({
        order,
        attempt,
        unitCosts,
        netPaidAtShipment,
        now,
      });
      const updated = order.ship({
        attemptId: attempt.deliveryAttemptId,
        dispatchMethod: input.body.dispatch.method,
        firstShipment,
        actor: { actorUserId: input.actorUserId, now },
      });
      const persisted = await this.dependencies.orders.update(updated, input.body.version);
      await recordShipmentSideEffects(this.dependencies, persisted.orderId);
      return persisted;
    });

    return toOrderResponse(
      shipped,
      await this.dependencies.payments.readTotals(shipped.orderId),
    );
  }
}

export class ReshipOrderUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: ShipOrderInput): Promise<OrderResponse> {
    const order = await loadTransitionOrder(this.dependencies, input);
    const now = this.dependencies.clock.now();

    const reshipped = await this.dependencies.unitOfWork.run(async () => {
      const attempt = DeliveryAttempt.start({
        organizationId: input.organizationId,
        orderId: order.orderId,
        ordinal: order.deliveryAttemptCount + 1,
        dispatch: input.body.dispatch,
        actorUserId: input.actorUserId,
        now,
      });
      await this.dependencies.deliveryAttempts.insert(attempt);
      const updated = order.reship({
        attemptId: attempt.deliveryAttemptId,
        dispatchMethod: input.body.dispatch.method,
        actor: { actorUserId: input.actorUserId, now },
      });
      const persisted = await this.dependencies.orders.update(updated, input.body.version);
      await recordShipmentSideEffects(this.dependencies, persisted.orderId);
      return persisted;
    });

    return toOrderResponse(
      reshipped,
      await this.dependencies.payments.readTotals(reshipped.orderId),
    );
  }
}
