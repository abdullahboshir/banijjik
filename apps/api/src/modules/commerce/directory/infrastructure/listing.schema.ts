import { LISTING_STATUS, type ListingStatus } from "@banijjik/contracts/directory";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";
import type { ListingSearchEntry } from "../domain/listing.entity.js";

export const LISTING_MODEL_NAME = "Listing";
export const LISTING_COLLECTION_NAME = "directory_listings";

export interface ListingConsentDocument {
  consentKey: string;
  textVersionHash: string;
  acceptedAt: Date;
}

export interface ListingRejectionDocument {
  reasonKeys: string[];
  note?: string;
}

export interface ListingDocument {
  listingId: string;
  organizationId: string;
  listingNumber: string;
  ownerCustomerAccountId: string;
  status: ListingStatus;
  customFields?: Record<string, unknown>;
  customFieldSearch?: ListingSearchEntry[];
  photoFileIds: string[];
  consentsAccepted: ListingConsentDocument[];
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedByUserId?: string;
  rejection?: ListingRejectionDocument;
  publishedAt?: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const consentSchema = new Schema<ListingConsentDocument>(
  {
    consentKey: { type: String, required: true },
    textVersionHash: { type: String, required: true },
    acceptedAt: { type: Date, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const rejectionSchema = new Schema<ListingRejectionDocument>(
  {
    reasonKeys: { type: [String], required: true },
    note: { type: String },
  },
  SUB_SCHEMA_OPTIONS,
);

const searchEntrySchema = new Schema<ListingSearchEntry>(
  {
    fieldKey: { type: String, required: true },
    value: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

export const listingSchema = new Schema<ListingDocument>(
  {
    ...domainIdField("listingId"),
    organizationId: { type: String, required: true, immutable: true },
    listingNumber: { type: String, required: true, immutable: true },
    ownerCustomerAccountId: { type: String, required: true, immutable: true },
    status: { type: String, required: true, enum: Object.values(LISTING_STATUS) },
    customFields: { type: Schema.Types.Mixed },
    customFieldSearch: { type: [searchEntrySchema], default: [] },
    photoFileIds: { type: [String], default: [] },
    consentsAccepted: { type: [consentSchema], default: [] },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedByUserId: { type: String },
    rejection: { type: rejectionSchema },
    publishedAt: { type: Date },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

listingSchema.index({ organizationId: 1, listingNumber: 1 }, { unique: true });
listingSchema.index(
  { organizationId: 1, ownerCustomerAccountId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "HIDDEN"] },
    },
  },
);
listingSchema.index({ organizationId: 1, status: 1, submittedAt: 1 });
listingSchema.index({ organizationId: 1, status: 1, publishedAt: -1 });
listingSchema.index({
  organizationId: 1,
  "customFieldSearch.fieldKey": 1,
  "customFieldSearch.value": 1,
});
