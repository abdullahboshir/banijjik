import {
  LISTING_REPORT_OUTCOME,
  LISTING_REPORT_STATUS,
  type ListingReportOutcome,
  type ListingReportStatus,
} from "@banijjik/contracts/directory";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const LISTING_REPORT_MODEL_NAME = "ListingReport";
export const LISTING_REPORT_COLLECTION_NAME = "listing_reports";

export interface ListingReportDocument {
  listingReportId: string;
  organizationId: string;
  listingId: string;
  reporterCustomerAccountId: string;
  reasonKey: string;
  note?: string;
  status: ListingReportStatus;
  outcome?: ListingReportOutcome;
  resolvedByUserId?: string;
  resolvedAt?: Date;
  resolutionNote?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const listingReportSchema = new Schema<ListingReportDocument>(
  {
    ...domainIdField("listingReportId"),
    organizationId: { type: String, required: true, immutable: true },
    listingId: { type: String, required: true, immutable: true },
    reporterCustomerAccountId: { type: String, required: true, immutable: true },
    reasonKey: { type: String, required: true },
    note: { type: String },
    status: {
      type: String,
      required: true,
      enum: Object.values(LISTING_REPORT_STATUS),
      default: LISTING_REPORT_STATUS.OPEN,
    },
    outcome: { type: String, enum: Object.values(LISTING_REPORT_OUTCOME) },
    resolvedByUserId: { type: String },
    resolvedAt: { type: Date },
    resolutionNote: { type: String },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

listingReportSchema.index({ organizationId: 1, status: 1, listingId: 1, createdAt: 1 });
/** One open report per reporter per listing (M.7 decision 2); resolved rows never collide. */
listingReportSchema.index(
  { organizationId: 1, listingId: 1, reporterCustomerAccountId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: LISTING_REPORT_STATUS.OPEN },
  },
);
listingReportSchema.index({ organizationId: 1, reporterCustomerAccountId: 1, createdAt: 1 });
