import type { CustomerAccountId, ListingId } from "@banijjik/ids";
import type { ListingBlock } from "../../domain/listing-block.entity.js";

export interface ListingBlockRepository {
  /** `created` is false when a parallel request already stored the same block (unique index). */
  insert(block: ListingBlock): Promise<{ readonly block: ListingBlock; readonly created: boolean }>;
  findByAccountAndListing(
    customerAccountId: CustomerAccountId,
    listingId: ListingId,
  ): Promise<ListingBlock | undefined>;
  countByAccount(customerAccountId: CustomerAccountId): Promise<number>;
  deleteByAccountAndListing(
    customerAccountId: CustomerAccountId,
    listingId: ListingId,
  ): Promise<boolean>;
  listByAccount(
    customerAccountId: CustomerAccountId,
    options: { readonly page: number; readonly limit: number },
  ): Promise<{ readonly items: readonly ListingBlock[]; readonly total: number }>;
  findBlockedListingIds(
    customerAccountId: CustomerAccountId,
    limit: number,
  ): Promise<readonly ListingId[]>;
  deleteByAccount(customerAccountId: CustomerAccountId): Promise<number>;
}
