import { Schema } from "mongoose";
import { domainIdField, SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const LISTING_UNLOCK_MODEL_NAME = "ListingUnlock";
export const LISTING_UNLOCK_COLLECTION_NAME = "listing_unlocks";

export interface ListingUnlockDocument {
  listingUnlockId: string;
  organizationId: string;
  customerAccountId: string;
  listingId: string;
  creditEntryId: string;
  unlockedAt: Date;
  createdAt: Date;
}

export const listingUnlockSchema = new Schema<ListingUnlockDocument>(
  {
    ...domainIdField("listingUnlockId"),
    organizationId: { type: String, required: true, immutable: true },
    customerAccountId: { type: String, required: true, immutable: true },
    listingId: { type: String, required: true, immutable: true },
    creditEntryId: { type: String, required: true, immutable: true },
    unlockedAt: { type: Date, required: true },
    createdAt: { type: Date, required: true, immutable: true },
  },
  SCHEMA_OPTIONS,
);

listingUnlockSchema.index(
  { organizationId: 1, customerAccountId: 1, listingId: 1 },
  { unique: true },
);
listingUnlockSchema.index({ organizationId: 1, listingId: 1 });
listingUnlockSchema.index({ organizationId: 1, customerAccountId: 1, unlockedAt: -1 });
