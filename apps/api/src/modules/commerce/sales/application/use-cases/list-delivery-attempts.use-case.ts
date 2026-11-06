import type { OrderId, OrganizationId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import type { DeliveryAttemptPage } from "../ports/delivery-attempt.repository.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import { assertLocationAllowed } from "../sales-transition-shared.js";

export interface ListDeliveryAttemptsInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly orderId: OrderId;
  readonly page: number;
  readonly limit: number;
}

export class ListDeliveryAttemptsUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: ListDeliveryAttemptsInput): Promise<DeliveryAttemptPage> {
    const order = await this.dependencies.orders.findById(input.orderId);
    if (order === undefined) throw recordNotFound();
    assertLocationAllowed(order.locationId, input.allowedLocationIds);

    return this.dependencies.deliveryAttempts.listByOrder({
      organizationId: input.organizationId,
      orderId: input.orderId,
      page: input.page,
      limit: input.limit,
    });
  }
}
