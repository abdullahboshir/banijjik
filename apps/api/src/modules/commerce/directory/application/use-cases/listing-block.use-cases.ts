import { DIRECTORY_SAFETY_RULES, type ListingBlockResponse } from "@banijjik/contracts/directory";
import type { CustomerAccountId, OrganizationId } from "@banijjik/ids";
import { blockAccountLimit, blockOwnListing, listingNotFound } from "../../domain/errors.js";
import { ListingBlock } from "../../domain/listing-block.entity.js";
import type { DirectoryDependencies } from "../directory-dependencies.js";

export interface BlockListingResult {
  readonly block: ListingBlockResponse;
  readonly created: boolean;
}

export class BlockListingUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly customerAccountId: CustomerAccountId;
    readonly listingNumber: string;
  }): Promise<BlockListingResult> {
    const listing = await this.dependencies.listings.findByListingNumber(input.listingNumber);
    if (listing === undefined) throw listingNotFound();
    if (listing.ownerCustomerAccountId === input.customerAccountId) {
      throw blockOwnListing();
    }
    const existing = await this.dependencies.blocks.findByAccountAndListing(
      input.customerAccountId,
      listing.listingId,
    );
    if (existing !== undefined) {
      return {
        block: {
          listingBlockId: existing.listingBlockId,
          listingId: existing.listingId,
          listingNumber: listing.listingNumber,
          createdAt: existing.createdAt.toISOString(),
        },
        created: false,
      };
    }
    const created = ListingBlock.create({
      organizationId: input.organizationId,
      customerAccountId: input.customerAccountId,
      listingId: listing.listingId,
      now: this.dependencies.clock.now(),
    });
    const inserted = await this.dependencies.blocks.insert(created);
    // Insert first, then count: two parallel requests cannot both slip past a stale count. When the
    // cap is passed the new row is removed again, so the stored count never stays above the cap.
    const count = await this.dependencies.blocks.countByAccount(input.customerAccountId);
    if (count > DIRECTORY_SAFETY_RULES.blocksPerAccountMax) {
      await this.dependencies.blocks.deleteByAccountAndListing(
        input.customerAccountId,
        listing.listingId,
      );
      throw blockAccountLimit();
    }
    return {
      block: {
        listingBlockId: inserted.listingBlockId,
        listingId: inserted.listingId,
        listingNumber: listing.listingNumber,
        createdAt: inserted.createdAt.toISOString(),
      },
      created: true,
    };
  }
}

export class UnblockListingUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly customerAccountId: CustomerAccountId;
    readonly listingNumber: string;
  }): Promise<void> {
    const listing = await this.dependencies.listings.findByListingNumber(input.listingNumber);
    if (listing === undefined) throw listingNotFound();
    await this.dependencies.blocks.deleteByAccountAndListing(
      input.customerAccountId,
      listing.listingId,
    );
  }
}

export class ListMyListingBlocksUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly customerAccountId: CustomerAccountId;
    readonly page: number;
    readonly limit: number;
  }): Promise<{
    readonly items: readonly ListingBlockResponse[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;
  }> {
    const paged = await this.dependencies.blocks.listByAccount(input.customerAccountId, {
      page: input.page,
      limit: input.limit,
    });
    const listingIds = paged.items.map((item) => item.listingId);
    const listings = await this.dependencies.listings.findByIds(listingIds);
    const listingMap = new Map(listings.map((l) => [l.listingId, l.listingNumber]));
    const items: ListingBlockResponse[] = paged.items.map((block) => ({
      listingBlockId: block.listingBlockId,
      listingId: block.listingId,
      listingNumber: listingMap.get(block.listingId) ?? "",
      createdAt: block.createdAt.toISOString(),
    }));
    return {
      items,
      total: paged.total,
      page: input.page,
      limit: input.limit,
    };
  }
}
