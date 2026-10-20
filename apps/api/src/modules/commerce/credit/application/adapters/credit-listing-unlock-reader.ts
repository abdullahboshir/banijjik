import type { ListingUnlockReader } from "../../../directory/index.js";
import type { ListingUnlockRepository } from "../ports/listing-unlock-repository.js";

export class CreditListingUnlockReader implements ListingUnlockReader {
  constructor(private readonly unlocks: ListingUnlockRepository) {}

  async hasUnlocked(listingId: string, customerAccountId: string): Promise<boolean> {
    const unlock = await this.unlocks.findByCustomerAndListing(customerAccountId, listingId);
    return unlock !== null;
  }
}
