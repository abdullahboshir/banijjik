import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const LISTING_STATS_MODEL_NAME = "DirectoryListingStats";
export const LISTING_STATS_COLLECTION_NAME = "directory_listing_stats";

/**
 * The pre-aggregated home counts of one business (M.6a decision 4). One row per organization,
 * written only by the directory stats handler; the storefront reads the row, never the listings.
 */
export interface ListingStatsDocument {
  directoryListingStatsId: string;
  organizationId: string;
  approvedCount: number;
  countsByOption: Record<string, number>;
  fieldKey: string | null;
  computedAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const listingStatsSchema = new Schema<ListingStatsDocument>(
  {
    ...domainIdField("directoryListingStatsId"),
    organizationId: { type: String, required: true, immutable: true },
    approvedCount: { type: Number, required: true, default: 0 },
    countsByOption: { type: Schema.Types.Mixed, required: true, default: {} },
    fieldKey: { type: String, default: null },
    computedAt: { type: Date, required: true },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

listingStatsSchema.index({ organizationId: 1 }, { unique: true });
