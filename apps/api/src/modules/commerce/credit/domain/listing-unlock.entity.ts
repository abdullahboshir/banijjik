import type { ListingUnlock } from "@banijjik/contracts/credit";
import type { CustomerAccountId, ListingId } from "@banijjik/ids";

export class ListingUnlockEntity {
  constructor(
    readonly listingUnlockId: string,
    readonly customerAccountId: CustomerAccountId,
    readonly listingId: ListingId,
    readonly creditEntryId: string,
    readonly unlockedAt: Date,
    readonly createdAt: Date,
  ) {}

  toResponse(): ListingUnlock {
    return {
      listingUnlockId: this.listingUnlockId,
      customerAccountId: this.customerAccountId,
      listingId: this.listingId,
      creditEntryId: this.creditEntryId,
      unlockedAt: this.unlockedAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
    };
  }

  static create(input: {
    listingUnlockId: string;
    customerAccountId: CustomerAccountId;
    listingId: ListingId;
    creditEntryId: string;
    unlockedAt: Date;
  }): ListingUnlockEntity {
    return new ListingUnlockEntity(
      input.listingUnlockId,
      input.customerAccountId,
      input.listingId,
      input.creditEntryId,
      input.unlockedAt,
      new Date(),
    );
  }
}
