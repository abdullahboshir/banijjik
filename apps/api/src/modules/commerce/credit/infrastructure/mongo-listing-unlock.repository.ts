import type { CustomerAccountId, ListingId } from "@banijjik/ids";
import {
  getActiveSession,
  getRequestContext,
  models,
  sessionOption,
} from "../../../../kernel/db/index.js";
import type { ListingUnlockRepository } from "../application/ports/listing-unlock-repository.js";
import type { ListingUnlock } from "../../domain/listing-unlock.entity.js";
import { LISTING_UNLOCK_MODEL_NAME, type ListingUnlockDocument } from "./listing-unlock.schema.js";

export class MongoListingUnlockRepository implements ListingUnlockRepository {
  async insert(unlock: ListingUnlock): Promise<void> {
    await this.model().create([this.toDocument(unlock)], sessionOption(getActiveSession()));
  }

  async findExisting(
    customerAccountId: CustomerAccountId,
    listingId: ListingId,
  ): Promise<ListingUnlock | null> {
    const organizationId = getRequestContext().organizationId;
    const doc = await this.model().findOne({ organizationId, customerAccountId, listingId });
    return doc ? this.fromDocument(doc) : null;
  }

  async findByCustomerAndListing(
    customerAccountId: CustomerAccountId,
    listingId: ListingId,
  ): Promise<ListingUnlock | null> {
    const organizationId = getRequestContext().organizationId;
    const doc = await this.model().findOne({ organizationId, customerAccountId, listingId });
    return doc ? this.fromDocument(doc) : null;
  }

  async listByCustomer(
    customerAccountId: CustomerAccountId,
    options: { limit: number; offset: number },
  ): Promise<readonly ListingUnlock[]> {
    const organizationId = getRequestContext().organizationId;
    const docs = await this.model()
      .find({ organizationId, customerAccountId })
      .sort({ unlockedAt: -1 })
      .skip(options.offset)
      .limit(options.limit);
    return docs.map((d) => this.fromDocument(d));
  }

  async countByListing(listingId: ListingId): Promise<number> {
    const organizationId = getRequestContext().organizationId;
    return this.model().countDocuments({ organizationId, listingId });
  }

  async countByCustomerToday(customerAccountId: CustomerAccountId, today: string): Promise<number> {
    const organizationId = getRequestContext().organizationId;
    const startOfDay = new Date(today);
    const endOfDay = new Date(today);
    endOfDay.setUTCHours(23, 59, 59, 999);
    return this.model().countDocuments({
      organizationId,
      customerAccountId,
      unlockedAt: { $gte: startOfDay, $lte: endOfDay },
    });
  }

  private model() {
    return models(LISTING_UNLOCK_MODEL_NAME);
  }

  private toDocument(unlock: ListingUnlock): ListingUnlockDocument {
    const organizationId = getRequestContext().organizationId;
    return {
      listingUnlockId: unlock.listingUnlockId,
      organizationId,
      customerAccountId: unlock.customerAccountId,
      listingId: unlock.listingId,
      creditEntryId: unlock.creditEntryId,
      unlockedAt: new Date(unlock.unlockedAt),
      createdAt: new Date(unlock.createdAt),
    };
  }

  private fromDocument(doc: ListingUnlockDocument): ListingUnlock {
    return {
      listingUnlockId: doc.listingUnlockId,
      customerAccountId: doc.customerAccountId as CustomerAccountId,
      listingId: doc.listingId as ListingId,
      creditEntryId: doc.creditEntryId,
      unlockedAt: doc.unlockedAt.toISOString(),
      createdAt: doc.createdAt.toISOString(),
    };
  }
}
