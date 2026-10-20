import type { CustomerAccountId, ListingId } from "@banijjik/ids";
import type { ListingUnlock } from "../../domain/listing-unlock.entity.js";

export interface ListingUnlockRepository {
  insert(unlock: ListingUnlock): Promise<void>;
  findExisting(
    customerAccountId: CustomerAccountId,
    listingId: ListingId,
  ): Promise<ListingUnlock | null>;
  listByCustomer(
    customerAccountId: CustomerAccountId,
    options: { limit: number; offset: number },
  ): Promise<readonly ListingUnlock[]>;
  countByListing(listingId: ListingId): Promise<number>;
  countByCustomerToday(customerAccountId: CustomerAccountId, today: string): Promise<number>;
}
