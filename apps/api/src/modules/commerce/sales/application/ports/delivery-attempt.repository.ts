import type { OrganizationId, OrderId } from "@banijjik/ids";
import type { DeliveryAttempt } from "../../domain/delivery-attempt.entity.js";

export interface DeliveryAttemptPage {
  readonly items: readonly DeliveryAttempt[];
  readonly hasNext: boolean;
}

export interface DeliveryAttemptRepository {
  insert(attempt: DeliveryAttempt): Promise<void>;
  update(attempt: DeliveryAttempt, expectedVersion: number): Promise<DeliveryAttempt>;
  findById(
    organizationId: OrganizationId,
    deliveryAttemptId: string,
  ): Promise<DeliveryAttempt | undefined>;
  listByOrder(input: {
    readonly organizationId: OrganizationId;
    readonly orderId: OrderId;
    readonly page: number;
    readonly limit: number;
  }): Promise<DeliveryAttemptPage>;
}
