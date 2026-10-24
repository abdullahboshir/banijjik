import type { ListingReportOutcome, ListingReportStatus } from "@banijjik/contracts/directory";
import type { CustomerAccountId, ListingId, ListingReportId, UserId } from "@banijjik/ids";
import type { ListingReport } from "../../domain/listing-report.entity.js";

export interface ListingReportPage<Row> {
  readonly items: readonly Row[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

/** One queue row: the open reports of a single listing, before the listing join (M.7 decision 4). */
export interface ListingReportQueueGroup {
  readonly listingId: ListingId;
  readonly openCount: number;
  readonly reasonKeys: readonly string[];
  readonly oldestReportAt: Date;
  readonly newestReportAt: Date;
}

export interface ListingReportListRequest {
  readonly listingId: ListingId;
  readonly status?: ListingReportStatus;
  readonly page: number;
  readonly limit: number;
}

export interface ResolvedReportUpdate {
  readonly reportIds: readonly ListingReportId[];
  readonly outcome: ListingReportOutcome;
  readonly actorUserId: UserId;
  readonly resolutionNote: string | undefined;
  readonly now: Date;
}

export interface ListingReportRepository {
  /** False when the unique open-report index rejected the insert: a concurrent second filing. */
  insert(report: ListingReport): Promise<boolean>;
  findOpenByListingAndReporter(
    listingId: ListingId,
    reporterCustomerAccountId: CustomerAccountId,
  ): Promise<ListingReport | undefined>;
  findByIds(reportIds: readonly ListingReportId[]): Promise<readonly ListingReport[]>;
  /** Reports filed since the start of the organization's business day (M.7 decision 3). */
  countFiledSince(reporterCustomerAccountId: CustomerAccountId, since: Date): Promise<number>;
  listForListing(request: ListingReportListRequest): Promise<ListingReportPage<ListingReport>>;
  /** Grouped by listing, oldest open report first; limit and page of the staff queue. */
  queueOpenGroups(page: number, limit: number): Promise<ListingReportPage<ListingReportQueueGroup>>;
  /** Conditional update on `status: OPEN`; returns how many reports actually closed. */
  markResolved(update: ResolvedReportUpdate): Promise<number>;
  /** Deletes OPEN reports filed by the account during self-erasure (M.7 decision 14). */
  deleteOpenByReporter(reporterCustomerAccountId: CustomerAccountId): Promise<number>;
  /** Reports filed by this customer account up to limit (for data export, M.7 decision 15). */
  listByReporter(
    reporterCustomerAccountId: CustomerAccountId,
    limit: number,
  ): Promise<readonly ListingReport[]>;
}
