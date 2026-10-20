import type { ListingUnlockReader } from "../../../directory/index.js";
import type { ListingUnlockRepository } from "../ports/listing-unlock-repository.js";
import type { CustomerAccountId, ListingId } from "@banijjik/ids";

export class CreditListingUnlockReader implements ListingUnlockReader {
  constructor(private readonly unlocks: ListingUnlockRepository) {}

  async hasUnlocked(listingId: string, customerAccountId: CustomerAccountId): Promise<boolean> {
    const unlock = await this.unlocks.findByCustomerAndListing(
      customerAccountId,
      listingId as ListingId,
    );
    return unlock !== null;
  }
}
