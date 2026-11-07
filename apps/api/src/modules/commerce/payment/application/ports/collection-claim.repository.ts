import type { OrderId, OrganizationId, PaymentId } from "@banijjik/ids";
import type { CollectionClaim } from "../../domain/collection-claim.entity.js";

export interface CollectionClaimRepository {
  save(claim: CollectionClaim): Promise<CollectionClaim>;
  findByPaymentId(
    organizationId: OrganizationId,
    paymentId: PaymentId,
  ): Promise<CollectionClaim | undefined>;
  findByOrderId(
    organizationId: OrganizationId,
    orderId: OrderId,
  ): Promise<readonly CollectionClaim[]>;
  findByIds(
    organizationId: OrganizationId,
    paymentIds: readonly PaymentId[],
  ): Promise<readonly CollectionClaim[]>;
  update(claim: CollectionClaim, expectedVersion: number): Promise<CollectionClaim>;
}
