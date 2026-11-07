import type {
  DeliveryLossClosureId,
  DeliveryLossRecoveryId,
  OrderId,
  OrganizationId,
} from "@banijjik/ids";
import type { DeliveryLossClosure, DeliveryLossRecovery } from "../../domain/delivery-loss.entity.js";

export interface DeliveryLossRepository {
  createClosure(closure: DeliveryLossClosure): Promise<DeliveryLossClosure>;
  updateClosure(closure: DeliveryLossClosure, expectedVersion: number): Promise<DeliveryLossClosure>;
  findClosureByOrderId(
    organizationId: OrganizationId,
    orderId: OrderId,
  ): Promise<DeliveryLossClosure | null>;
  findClosureById(
    organizationId: OrganizationId,
    deliveryLossClosureId: DeliveryLossClosureId,
  ): Promise<DeliveryLossClosure | null>;
  createRecovery(recovery: DeliveryLossRecovery): Promise<DeliveryLossRecovery>;
  findRecoveryById(
    organizationId: OrganizationId,
    deliveryLossRecoveryId: DeliveryLossRecoveryId,
  ): Promise<DeliveryLossRecovery | null>;
  listRecoveries(
    organizationId: OrganizationId,
    deliveryLossClosureId: DeliveryLossClosureId,
  ): Promise<readonly DeliveryLossRecovery[]>;
}
