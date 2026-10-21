import type { ListingUnlockReader } from "../../../directory/index.js";
import type { ListingUnlockRepository } from "../ports/listing-unlock-repository.js";
import type { CustomerAccountId, ListingId } from "@banijjik/ids";

export class CreditListingUnlockReader implements ListingUnlockReader {
  constructor(private readonly unlocks: ListingUnlockRepository) {}

  async hasUnlocked(listingId: string, customerAccountId: string): Promise<boolean> {
    const unlock = await this.unlocks.findByCustomerAndListing(
      customerAccountId as CustomerAccountId,
      listingId as ListingId,
    );
    return unlock !== null;
  }

  async unlockedListingIds(
    customerAccountId: string,
    listingIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    const unlocked = await this.unlocks.findUnlockedListingIds(
      customerAccountId as CustomerAccountId,
      listingIds.map((listingId) => listingId as ListingId),
    );
    return new Set(unlocked);
  }
}
