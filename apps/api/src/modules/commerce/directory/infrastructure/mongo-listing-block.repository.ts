import {
  asId,
  type CustomerAccountId,
  type ListingBlockId,
  type ListingId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  stripMongoInternals,
} from "../../../../kernel/db/index.js";
import type { ListingBlockRepository } from "../application/ports/listing-block-repository.js";
import { ListingBlock } from "../domain/listing-block.entity.js";
import { LISTING_BLOCK_MODEL_NAME, type ListingBlockDocument } from "./listing-block.schema.js";

function toListingBlock(doc: ListingBlockDocument): ListingBlock {
  const stored = stripMongoInternals(doc);
  return new ListingBlock({
    listingBlockId: asId<ListingBlockId>(stored.listingBlockId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    customerAccountId: asId<CustomerAccountId>(stored.customerAccountId),
    listingId: asId<ListingId>(stored.listingId),
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: stored.createdByUserId === null ? null : asId<UserId>(stored.createdByUserId),
    updatedByUserId: stored.updatedByUserId === null ? null : asId<UserId>(stored.updatedByUserId),
  });
}

function toListingBlockDocument(block: ListingBlock): ListingBlockDocument {
  return {
    listingBlockId: block.listingBlockId,
    organizationId: block.organizationId,
    customerAccountId: block.customerAccountId,
    listingId: block.listingId,
    version: block.version,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    createdByUserId: block.createdByUserId,
    updatedByUserId: block.updatedByUserId,
  };
}

export class MongoListingBlockRepository implements ListingBlockRepository {
  async insert(block: ListingBlock): Promise<ListingBlock> {
    try {
      const [saved] = await this.model().create(
        [toListingBlockDocument(block)],
        sessionOption(getActiveSession()),
      );
      if (saved === undefined) {
        throw new Error("Failed to insert listing block");
      }
      return toListingBlock(saved.toObject());
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existing = await this.findByAccountAndListing(
          block.customerAccountId,
          block.listingId,
        );
        if (existing !== undefined) return existing;
      }
      throw error;
    }
  }

  async findByAccountAndListing(
    customerAccountId: CustomerAccountId,
    listingId: ListingId,
  ): Promise<ListingBlock | undefined> {
    const doc = await this.model()
      .findOne({ customerAccountId, listingId }, null, sessionOption(getActiveSession()))
      .lean<ListingBlockDocument>()
      .exec();
    return doc === null ? undefined : toListingBlock(doc);
  }

  async countByAccount(customerAccountId: CustomerAccountId): Promise<number> {
    return this.model()
      .countDocuments({ customerAccountId }, sessionOption(getActiveSession()))
      .exec();
  }

  async deleteByAccountAndListing(
    customerAccountId: CustomerAccountId,
    listingId: ListingId,
  ): Promise<boolean> {
    const result = await this.model().deleteOne(
      { customerAccountId, listingId },
      sessionOption(getActiveSession()),
    );
    return result.deletedCount === 1;
  }

  async listByAccount(
    customerAccountId: CustomerAccountId,
    options: { readonly page: number; readonly limit: number },
  ): Promise<{ readonly items: readonly ListingBlock[]; readonly total: number }> {
    const skip = (options.page - 1) * options.limit;
    const [docs, total] = await Promise.all([
      this.model()
        .find({ customerAccountId }, null, sessionOption(getActiveSession()))
        // listingBlockId breaks ties so a page boundary never repeats or skips a row.
        .sort({ createdAt: -1, listingBlockId: -1 })
        .skip(skip)
        .limit(options.limit)
        .lean<ListingBlockDocument[]>()
        .exec(),
      this.model().countDocuments({ customerAccountId }, sessionOption(getActiveSession())).exec(),
    ]);
    return {
      items: docs.map(toListingBlock),
      total,
    };
  }

  async findBlockedListingIds(
    customerAccountId: CustomerAccountId,
    limit: number,
  ): Promise<readonly ListingId[]> {
    const docs = await this.model()
      .find({ customerAccountId }, { listingId: 1 }, sessionOption(getActiveSession()))
      .limit(limit)
      .lean<Pick<ListingBlockDocument, "listingId">[]>()
      .exec();
    return docs.map((doc) => asId<ListingId>(doc.listingId));
  }

  async deleteByAccount(customerAccountId: CustomerAccountId): Promise<number> {
    const result = await this.model().deleteMany(
      { customerAccountId },
      sessionOption(getActiveSession()),
    );
    return result.deletedCount;
  }

  private model() {
    return models({}).get<ListingBlockDocument>(LISTING_BLOCK_MODEL_NAME);
  }
}
