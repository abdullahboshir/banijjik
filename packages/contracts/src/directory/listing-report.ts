import { defineEnum } from "../define-enum.js";
import type { ListingStatus } from "./listing-status.js";

/** A report is OPEN until staff resolve it with an outcome (card M.7, ADR-134). */
export const LISTING_REPORT_STATUS = defineEnum(["OPEN", "RESOLVED"]);
export type ListingReportStatus =
  (typeof LISTING_REPORT_STATUS)[keyof typeof LISTING_REPORT_STATUS];

/** What staff decided when closing reports (M.7 decision 5). */
export const LISTING_REPORT_OUTCOME = defineEnum([
  "DISMISSED",
  "WARNED",
  "LISTING_HIDDEN",
  "ACCOUNT_BLOCKED",
]);
export type ListingReportOutcome =
  (typeof LISTING_REPORT_OUTCOME)[keyof typeof LISTING_REPORT_OUTCOME];

/** Trust-and-safety limits. Constants, not settings: platform policy (M.7 decisions 3, 8 and 9). */
export const DIRECTORY_SAFETY_RULES = {
  reportsPerAccountPerDay: 10,
  reportNoteMaxLength: 500,
  resolutionNoteMaxLength: 500,
  maxReportIdsPerResolve: 100,
  blocksPerAccountMax: 500,
} as const;

/** Listing block response (M.7 decision 9). */
export interface ListingBlockResponse {
  readonly listingBlockId: string;
  readonly listingId: string;
  readonly listingNumber: string;
  readonly createdAt: string;
}

/** One entry of the template's `reportReasons` (M.7 decision 1). */
export interface DirectoryReportReason {
  readonly reasonKey: string;
  readonly label: { readonly bn: string; readonly en: string };
}

/** Body of POST /listings/:listingNumber/reports (M.7 decision 3). */
export interface ListingReportFileRequest {
  readonly reasonKey: string;
  readonly note?: string;
}

/** Body of POST /listings/:listingId/reports/resolve (M.7 decision 5). */
export interface ListingReportResolveRequest {
  readonly reportIds: readonly string[];
  readonly outcome: ListingReportOutcome;
  readonly note?: string;
}

/** Staff row of one listing's reports (M.7 decision 4). Never the reporter's phone. */
export interface ListingReportResponse {
  readonly listingReportId: string;
  readonly reasonKey: string;
  readonly note: string | null;
  readonly status: ListingReportStatus;
  readonly outcome: ListingReportOutcome | null;
  readonly reporterCustomerAccountId: string;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
  readonly resolvedByUserId: string | null;
}

/** Queue item: open reports of one listing, oldest listing first (M.7 decision 4). */
export interface ListingReportQueueItem {
  readonly listingId: string;
  readonly listingNumber: string;
  readonly listingStatus: ListingStatus;
  readonly openCount: number;
  readonly reasonKeys: readonly string[];
  readonly oldestReportAt: string;
  readonly newestReportAt: string;
}

/** Payload of directory.listingReport.filed — no reporter-visible extras. */
export interface ListingReportFiledPayload {
  readonly listingId: string;
  readonly listingReportId: string;
  readonly reasonKey: string;
}

/** Payload of directory.listingReport.resolved — no note, no reporter ids (M.7 decision 5). */
export interface ListingReportResolvedPayload {
  readonly listingId: string;
  readonly outcome: ListingReportOutcome;
  readonly reportIds: readonly string[];
  readonly ownerCustomerAccountId: string;
}
