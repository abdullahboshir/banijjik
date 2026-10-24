import type { CustomerAccountId, ListingId } from "@banijjik/ids";
import type { ListingBlock } from "../../domain/listing-block.entity.js";

export interface ListingBlockRepository {
  insert(block: ListingBlock): Promise<ListingBlock>;
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
