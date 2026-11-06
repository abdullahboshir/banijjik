import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import {
  ORDER_STATUS,
  SALES_EVENT_TYPE,
  type OrderResponse,
} from "@banijjik/contracts/sales";
import type { DeliverOrderRequest } from "@banijjik/contracts/sales/delivery";
import type { OrderId, OrganizationId, UserId } from "@banijjik/ids";
import { invalidTransition, recordNotFound } from "../../domain/errors.js";
import type { Order } from "../../domain/order.entity.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import {
  assertLocationAllowed,
  orderOrderingKey,
} from "../sales-transition-shared.js";
import { toOrderResponse } from "../sales-views.js";

export interface DeliverOrderInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly actorUserId: UserId;
  readonly orderId: OrderId;
  readonly body: DeliverOrderRequest;
}

async function loadTransitionOrder(
  dependencies: Pick<SalesDependencies, "orders">,
  input: Pick<DeliverOrderInput, "orderId" | "allowedLocationIds">,
): Promise<Order> {
  const order = await dependencies.orders.findById(input.orderId);
  if (order === undefined) throw recordNotFound();
  assertLocationAllowed(order.locationId, input.allowedLocationIds);
  return order;
}

export class DeliverOrderUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: DeliverOrderInput): Promise<OrderResponse> {
    const order = await loadTransitionOrder(this.dependencies, input);
    if (order.status !== ORDER_STATUS.SHIPPED) {
      throw invalidTransition(order.status);
    }

    const now = this.dependencies.clock.now();

    const delivered = await this.dependencies.unitOfWork.run(async () => {
      const updated = order.deliver({ actorUserId: input.actorUserId, now });
      const persisted = await this.dependencies.orders.update(updated, input.body.version);

      await this.dependencies.events.publish(
        SALES_EVENT_TYPE.ORDER_DELIVERED,
        { orderId: persisted.orderId },
        { orderingKey: orderOrderingKey(persisted.orderId) },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ORDER_DELIVERED,
        entityType: AUDIT_ENTITY_TYPE.order,
        entityId: persisted.orderId,
        changes: {
          status: { to: ORDER_STATUS.DELIVERED },
          ...(input.body.note ? { note: { to: input.body.note } } : {}),
        },
      });
      return persisted;
    });

    return toOrderResponse(
      delivered,
      await this.dependencies.payments.readTotals(delivered.orderId),
    );
  }
}
