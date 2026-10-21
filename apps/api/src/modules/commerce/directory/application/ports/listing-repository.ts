import type { ListingStatus } from "@banijjik/contracts/directory";
import type { CustomerAccountId, ListingId, UserId } from "@banijjik/ids";
import type { Listing } from "../../domain/listing.entity.js";

export interface ListingSearchFilter {
  readonly fieldKey: string;
  readonly value: string;
  readonly minValue?: string;
  readonly maxValue?: string;
  readonly anyOf?: readonly string[];
}

export interface ListingSearchRequest {
  readonly listingNumber?: string;
  readonly filters: readonly ListingSearchFilter[];
  readonly page: number;
  readonly limit: number;
}

export interface ListingQueueRequest {
  readonly status?: ListingStatus;
  readonly page: number;
  readonly limit: number;
}

/** Staff all-listings filters (card M.3, ADR-129). */
export interface ListingStaffListRequest {
  readonly status?: ListingStatus;
  readonly listingNumber?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly page: number;
  readonly limit: number;
}

export interface ListingPage<Row> {
  readonly items: readonly Row[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface ListingRepository {
  insert(listing: Listing): Promise<void>;
  save(listing: Listing, expectedVersion: number, actorUserId: UserId | null): Promise<Listing>;
  findById(listingId: ListingId): Promise<Listing | undefined>;
  findByIds(listingIds: readonly ListingId[]): Promise<readonly Listing[]>;
  findByListingNumber(listingNumber: string): Promise<Listing | undefined>;
  findActiveByOwner(ownerCustomerAccountId: CustomerAccountId): Promise<Listing | undefined>;
  searchApproved(request: ListingSearchRequest): Promise<ListingPage<Listing>>;
  listQueue(request: ListingQueueRequest): Promise<ListingPage<Listing>>;
  listStaff(request: ListingStaffListRequest): Promise<ListingPage<Listing>>;
  /** For the explain test: returns whether the planner used the attribute index. */
  explainSearch(request: ListingSearchRequest): Promise<{ readonly usesAttributeIndex: boolean }>;
}
