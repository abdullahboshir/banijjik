import type { CustomerAccountId, ListingId } from "@banijjik/ids";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { ListingUnlockRepository } from "../application/ports/listing-unlock-repository.js";
import type { ListingUnlock } from "../domain/index.js";
import { LISTING_UNLOCK_MODEL_NAME, type ListingUnlockDocument } from "./listing-unlock.schema.js";

function getOrganizationId(): string {
  const context = getRequestContext();
  if (!context.organizationId) {
    throw new Error("Organization context required");
  }
  return context.organizationId;
}

export class MongoListingUnlockRepository implements ListingUnlockRepository {
  async insert(unlock: ListingUnlock): Promise<void> {
    const Model = models({ organizationId: getOrganizationId() }).get<ListingUnlockDocument>(
      LISTING_UNLOCK_MODEL_NAME,
    );
    await Model.create([this.toDocument(unlock)], sessionOption(getActiveSession()));
  }

  async findExisting(
    customerAccountId: CustomerAccountId,
    listingId: ListingId,
  ): Promise<ListingUnlock | null> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<ListingUnlockDocument>(LISTING_UNLOCK_MODEL_NAME);
    const doc = await Model.findOne({ organizationId, customerAccountId, listingId });
    return doc ? this.fromDocument(doc) : null;
  }

  async findByCustomerAndListing(
    customerAccountId: CustomerAccountId,
    listingId: ListingId,
  ): Promise<ListingUnlock | null> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<ListingUnlockDocument>(LISTING_UNLOCK_MODEL_NAME);
    const doc = await Model.findOne({ organizationId, customerAccountId, listingId });
    return doc ? this.fromDocument(doc) : null;
  }

  async listByCustomer(
    customerAccountId: CustomerAccountId,
    options: { limit: number; offset: number },
  ): Promise<readonly ListingUnlock[]> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<ListingUnlockDocument>(LISTING_UNLOCK_MODEL_NAME);
    const docs = await Model.find({ organizationId, customerAccountId })
      .sort({ unlockedAt: -1 })
      .skip(options.offset)
      .limit(options.limit);
    return docs.map((d: ListingUnlockDocument) => this.fromDocument(d));
  }

  async countByListing(listingId: ListingId): Promise<number> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<ListingUnlockDocument>(LISTING_UNLOCK_MODEL_NAME);
    return Model.countDocuments({ organizationId, listingId });
  }

  async countByCustomerToday(customerAccountId: CustomerAccountId, today: string): Promise<number> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<ListingUnlockDocument>(LISTING_UNLOCK_MODEL_NAME);
    const startOfDay = new Date(today);
    const endOfDay = new Date(today);
    endOfDay.setUTCHours(23, 59, 59, 999);
    return Model.countDocuments({
      organizationId,
      customerAccountId,
      unlockedAt: { $gte: startOfDay, $lte: endOfDay },
    });
  }

  private toDocument(unlock: ListingUnlock): ListingUnlockDocument {
    const organizationId = getOrganizationId();
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
