import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { SALES_EVENT_TYPE, type OrderResponse } from "@banijjik/contracts/sales";
import type { DeliveryFailedRequest } from "@banijjik/contracts/sales/delivery";
import type { OrderId, OrganizationId, UserId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import type { Order } from "../../domain/order.entity.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import {
  assertLocationAllowed,
  orderOrderingKey,
} from "../sales-transition-shared.js";
import { toOrderResponse } from "../sales-views.js";

export interface FailDeliveryInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly actorUserId: UserId;
  readonly orderId: OrderId;
  readonly body: DeliveryFailedRequest;
}

async function loadTransitionOrder(
  dependencies: Pick<SalesDependencies, "orders">,
  input: Pick<FailDeliveryInput, "orderId" | "allowedLocationIds">,
): Promise<Order> {
  const order = await dependencies.orders.findById(input.orderId);
  if (order === undefined) throw recordNotFound();
  assertLocationAllowed(order.locationId, input.allowedLocationIds);
  return order;
}

export class FailDeliveryUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: FailDeliveryInput): Promise<OrderResponse> {
    const order = await loadTransitionOrder(this.dependencies, input);
    const now = this.dependencies.clock.now();

    const failed = await this.dependencies.unitOfWork.run(async () => {
      if (order.currentDeliveryAttemptId === null) {
        throw recordNotFound();
      }
      const attempt = await this.dependencies.deliveryAttempts.findById(
        input.organizationId,
        order.currentDeliveryAttemptId,
      );
      if (attempt === undefined) {
        throw recordNotFound();
      }

      const failedAttempt = attempt.markFailed({
        reasonKey: input.body.reasonKey,
        ...(input.body.note === undefined ? {} : { note: input.body.note }),
        actorUserId: input.actorUserId,
        now,
      });
      await this.dependencies.deliveryAttempts.update(failedAttempt, attempt.version);

      const updated = order.failDelivery({ actorUserId: input.actorUserId, now });
      const persisted = await this.dependencies.orders.update(updated, input.body.version);

      await this.dependencies.events.publish(
        SALES_EVENT_TYPE.ORDER_DELIVERY_FAILED,
        { orderId: persisted.orderId },
        { orderingKey: orderOrderingKey(persisted.orderId) },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ORDER_DELIVERY_FAILED,
        entityType: AUDIT_ENTITY_TYPE.order,
        entityId: persisted.orderId,
        changes: {},
      });
      return persisted;
    });

    return toOrderResponse(
      failed,
      await this.dependencies.payments.readTotals(failed.orderId),
    );
  }
}
