import type { OrganizationId, PaymentId, UserId } from "@banijjik/ids";
import { collectionClaimMismatchError } from "../../domain/errors.js";
import type { CollectionClaimRepository } from "../ports/collection-claim.repository.js";

export interface ReleaseCollectionsInput {
  readonly organizationId: OrganizationId;
  readonly paymentIds: readonly PaymentId[];
  readonly carrierMethod: "COD_COURIER" | "RIDER_CASH";
  readonly referenceId: string;
  readonly actorUserId: UserId | null;
  readonly now: Date;
}

export class ReleaseCollectionsUseCase {
  constructor(private readonly collectionClaims: CollectionClaimRepository) {}

  async execute(input: ReleaseCollectionsInput): Promise<void> {
    if (input.paymentIds.length === 0) return;

    const claims = await this.collectionClaims.findByIds(input.organizationId, input.paymentIds);

    if (claims.length === 0) return;

    for (const claim of claims) {
      if (claim.carrier.method !== input.carrierMethod) {
        throw collectionClaimMismatchError(
          `Claim carrier method ${claim.carrier.method} does not match settlement carrier method ${input.carrierMethod}`,
        );
      }
      if (claim.claimedByReference !== input.referenceId) {
        throw collectionClaimMismatchError(
          `Claim was claimed by reference ${claim.claimedByReference}, cannot release from ${input.referenceId}`,
        );
      }
      const updated = claim.release(input.actorUserId, input.now);
      await this.collectionClaims.update(updated, claim.version);
    }
  }
}
