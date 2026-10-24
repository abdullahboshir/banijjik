import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const LISTING_BLOCK_MODEL_NAME = "ListingBlock";
export const LISTING_BLOCK_COLLECTION_NAME = "listing_blocks";

export interface ListingBlockDocument {
  listingBlockId: string;
  organizationId: string;
  customerAccountId: string;
  listingId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const listingBlockSchema = new Schema<ListingBlockDocument>(
  {
    ...domainIdField("listingBlockId"),
    organizationId: { type: String, required: true, immutable: true },
    customerAccountId: { type: String, required: true, immutable: true },
    listingId: { type: String, required: true, immutable: true },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

// Unique block per customer per listing in an organization
listingBlockSchema.index(
  { organizationId: 1, customerAccountId: 1, listingId: 1 },
  { unique: true },
);

// List index for paginated blocks
listingBlockSchema.index({ organizationId: 1, customerAccountId: 1, createdAt: -1 });
