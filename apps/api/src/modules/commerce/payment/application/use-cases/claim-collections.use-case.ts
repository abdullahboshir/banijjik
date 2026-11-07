import type { OrganizationId, PaymentId, UserId } from "@banijjik/ids";
import { collectionClaimMismatchError } from "../../domain/errors.js";
import type { CollectionClaimRepository } from "../ports/collection-claim.repository.js";

export interface ClaimCollectionsInput {
  readonly organizationId: OrganizationId;
  readonly paymentIds: readonly PaymentId[];
  readonly carrierMethod: "COD_COURIER" | "RIDER_CASH";
  readonly referenceId: string;
  readonly actorUserId: UserId | null;
  readonly now: Date;
}

export class ClaimCollectionsUseCase {
  constructor(private readonly collectionClaims: CollectionClaimRepository) {}

  async execute(input: ClaimCollectionsInput): Promise<void> {
    if (input.paymentIds.length === 0) return;

    const claims = await this.collectionClaims.findByIds(input.organizationId, input.paymentIds);

    if (claims.length === 0) return;

    for (const claim of claims) {
      if (claim.carrier.method !== input.carrierMethod) {
        throw collectionClaimMismatchError(
          `Claim carrier method ${claim.carrier.method} does not match settlement carrier method ${input.carrierMethod}`,
        );
      }
      const updated = claim.claim(input.referenceId, input.actorUserId, input.now);
      await this.collectionClaims.update(updated, claim.version);
    }
  }
}
