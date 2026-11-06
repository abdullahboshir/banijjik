import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { STOCK_SOURCE_TYPE, type StockReturnDisposition } from "@banijjik/contracts/inventory";
import {
  ORDER_STATUS,
  SALES_EVENT_TYPE,
  type OrderResponse,
} from "@banijjik/contracts/sales";
import type { ReceiveRtsRequest } from "@banijjik/contracts/sales/delivery";
import type { OrderId, OrganizationId, UserId } from "@banijjik/ids";
import { invalidTransition, recordNotFound } from "../../domain/errors.js";
import type { Order } from "../../domain/order.entity.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import {
  assertLocationAllowed,
  orderOrderingKey,
  stockInputOf,
} from "../sales-transition-shared.js";
import { toOrderResponse } from "../sales-views.js";

export interface ReceiveRtsInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly actorUserId: UserId;
  readonly orderId: OrderId;
  readonly body: ReceiveRtsRequest;
}

async function loadTransitionOrder(
  dependencies: Pick<SalesDependencies, "orders">,
  input: Pick<ReceiveRtsInput, "orderId" | "allowedLocationIds">,
): Promise<Order> {
  const order = await dependencies.orders.findById(input.orderId);
  if (order === undefined) throw recordNotFound();
  assertLocationAllowed(order.locationId, input.allowedLocationIds);
  return order;
}

export class ReceiveRtsUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: ReceiveRtsInput): Promise<OrderResponse> {
    const order = await loadTransitionOrder(this.dependencies, input);
    if (order.status !== ORDER_STATUS.DELIVERY_FAILED) {
      throw invalidTransition(order.status);
    }

    const settings = await this.dependencies.settings.read(input.organizationId);
    const now = this.dependencies.clock.now();

    const returned = await this.dependencies.unitOfWork.run(async () => {
      await this.restockOrder(order, input, settings.allowNegativeStock);

      await this.dependencies.payments.settleCancellation({
        organizationId: input.organizationId,
        orderId: order.orderId,
        contactId: order.contactId,
        locationId: order.locationId,
        actorUserId: input.actorUserId,
        now,
      });

      const updated = order.receiveRts({ actorUserId: input.actorUserId, now });
      const persisted = await this.dependencies.orders.update(updated, input.body.version);

      await this.dependencies.events.publish(
        SALES_EVENT_TYPE.ORDER_RETURNED_TO_SENDER,
        { orderId: persisted.orderId },
        { orderingKey: orderOrderingKey(persisted.orderId) },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ORDER_RETURNED_TO_SENDER,
        entityType: AUDIT_ENTITY_TYPE.order,
        entityId: persisted.orderId,
        changes: {
          status: { to: ORDER_STATUS.RETURNED_TO_SENDER },
          ...(input.body.reasonKey ? { reasonKey: { to: input.body.reasonKey } } : {}),
          ...(input.body.restockDisposition
            ? { restockDisposition: { to: input.body.restockDisposition } }
            : {}),
        },
      });
      return persisted;
    });

    return toOrderResponse(
      returned,
      await this.dependencies.payments.readTotals(returned.orderId),
    );
  }

  private async restockOrder(
    order: Order,
    input: ReceiveRtsInput,
    allowNegativeStock: boolean,
  ): Promise<void> {
    if (!order.hasStockLines) return;
    const disposition: StockReturnDisposition =
      input.body.restockDisposition === "RETURN_DAMAGED" ? "RETURN_DAMAGED" : "RETURN";
    await this.dependencies.stock.returnStock({
      ...stockInputOf({
        organizationId: input.organizationId,
        locationId: order.locationId,
        actorUserId: input.actorUserId,
        orderId: order.orderId,
        lines: order.lines,
        allowNegativeStock,
      }),
      actorUserId: input.actorUserId,
      disposition,
      costFrom: {
        sourceType: STOCK_SOURCE_TYPE.ORDER,
        sourceId: order.orderId,
      },
    });
  }
}
