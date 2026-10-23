import {
  LISTING_REPORT_STATUS,
  type ListingReportOutcome,
  type ListingReportStatus,
} from "@banijjik/contracts/directory";
import {
  newId,
  type CustomerAccountId,
  type ListingId,
  type ListingReportId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { reportStale } from "./errors.js";

export interface ListingReportProps {
  readonly listingReportId: ListingReportId;
  readonly organizationId: OrganizationId;
  readonly listingId: ListingId;
  readonly reporterCustomerAccountId: CustomerAccountId;
  readonly reasonKey: string;
  readonly note: string | undefined;
  readonly status: ListingReportStatus;
  readonly outcome: ListingReportOutcome | undefined;
  readonly resolvedByUserId: UserId | undefined;
  readonly resolvedAt: Date | undefined;
  readonly resolutionNote: string | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

/** What staff decide about a report: the outcome and the note shown to the reporter. */
export interface ListingReportResolution {
  readonly outcome: ListingReportOutcome;
  readonly resolutionNote: string | undefined;
}

export interface NewListingReportInput {
  readonly organizationId: OrganizationId;
  readonly listingId: ListingId;
  readonly reporterCustomerAccountId: CustomerAccountId;
  readonly reasonKey: string;
  readonly note: string | undefined;
  readonly now: Date;
}

/** A customer's report of a listing (card M.7, ADR-134). Immutable transitions, like Listing. */
export class ListingReport implements ListingReportProps {
  readonly listingReportId: ListingReportId;
  readonly organizationId: OrganizationId;
  readonly listingId: ListingId;
  readonly reporterCustomerAccountId: CustomerAccountId;
  readonly reasonKey: string;
  readonly note: string | undefined;
  readonly status: ListingReportStatus;
  readonly outcome: ListingReportOutcome | undefined;
  readonly resolvedByUserId: UserId | undefined;
  readonly resolvedAt: Date | undefined;
  readonly resolutionNote: string | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;

  private constructor(props: ListingReportProps) {
    this.listingReportId = props.listingReportId;
    this.organizationId = props.organizationId;
    this.listingId = props.listingId;
    this.reporterCustomerAccountId = props.reporterCustomerAccountId;
    this.reasonKey = props.reasonKey;
    this.note = props.note;
    this.status = props.status;
    this.outcome = props.outcome;
    this.resolvedByUserId = props.resolvedByUserId;
    this.resolvedAt = props.resolvedAt;
    this.resolutionNote = props.resolutionNote;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  static create(input: NewListingReportInput): ListingReport {
    return new ListingReport({
      listingReportId: newId<ListingReportId>(),
      organizationId: input.organizationId,
      listingId: input.listingId,
      reporterCustomerAccountId: input.reporterCustomerAccountId,
      reasonKey: input.reasonKey,
      note: input.note,
      status: LISTING_REPORT_STATUS.OPEN,
      outcome: undefined,
      resolvedByUserId: undefined,
      resolvedAt: undefined,
      resolutionNote: undefined,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      // The reporter is a customer account, never a staff user (M.7 decision 3).
      createdByUserId: null,
      updatedByUserId: null,
    });
  }

  static restore(props: ListingReportProps): ListingReport {
    return new ListingReport(props);
  }

  isOpen(): boolean {
    return this.status === LISTING_REPORT_STATUS.OPEN;
  }

  /** Staff close the report with an outcome; a resolved report is stale for a second resolve. */
  resolve(resolution: ListingReportResolution, now: Date, actorUserId: UserId): ListingReport {
    if (!this.isOpen()) throw reportStale();
    return new ListingReport({
      ...this.snapshot(),
      status: LISTING_REPORT_STATUS.RESOLVED,
      outcome: resolution.outcome,
      resolvedByUserId: actorUserId,
      resolvedAt: now,
      resolutionNote: resolution.resolutionNote,
      version: this.version + 1,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }

  private snapshot(): ListingReportProps {
    return {
      listingReportId: this.listingReportId,
      organizationId: this.organizationId,
      listingId: this.listingId,
      reporterCustomerAccountId: this.reporterCustomerAccountId,
      reasonKey: this.reasonKey,
      note: this.note,
      status: this.status,
      outcome: this.outcome,
      resolvedByUserId: this.resolvedByUserId,
      resolvedAt: this.resolvedAt,
      resolutionNote: this.resolutionNote,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdByUserId: this.createdByUserId,
      updatedByUserId: this.updatedByUserId,
    };
  }
}
