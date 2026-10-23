import type { CustomerAccountId, ListingId } from "@banijjik/ids";
import type { ListingUnlock } from "../../domain/index.js";

export interface ListingUnlockRepository {
  /** Throws ListingUnlockAlreadyExistsError when the (account, listing) unique key already exists. */
  insert(unlock: ListingUnlock): Promise<void>;
  findExisting(
    customerAccountId: CustomerAccountId,
    listingId: ListingId,
  ): Promise<ListingUnlock | null>;
  findByCustomerAndListing(
    customerAccountId: CustomerAccountId,
    listingId: ListingId,
  ): Promise<ListingUnlock | null>;
  listByCustomer(
    customerAccountId: CustomerAccountId,
    options: { limit: number; offset: number },
  ): Promise<readonly ListingUnlock[]>;
  countByListing(listingId: ListingId): Promise<number>;
  /** Which of these listings the account already unlocked, in one query (directory projection). */
  findUnlockedListingIds(
    customerAccountId: CustomerAccountId,
    listingIds: readonly ListingId[],
  ): Promise<ReadonlySet<ListingId>>;
  /** Unlocks inside one business day of the organization (`from` inclusive, `to` exclusive). */
  countByCustomerToday(
    customerAccountId: CustomerAccountId,
    businessDay: { readonly from: Date; readonly to: Date },
  ): Promise<number>;
}
