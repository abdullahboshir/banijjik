import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ERROR_CODE, PERMISSION_KEY } from "@banijjik/contracts";
import {
  DIRECTORY_EVENT_TYPE,
  DIRECTORY_SAFETY_RULES,
  LISTING_REPORT_OUTCOME,
  LISTING_STATUS,
  type DirectoryReportReason,
  type ListingReportFileRequest,
  type ListingReportOutcome,
  type ListingReportQueueItem,
  type ListingReportResolveRequest,
  type ListingReportResponse,
  type ListingReportStatus,
} from "@banijjik/contracts/directory";
import {
  asId,
  type CustomerAccountId,
  type ListingId,
  type ListingReportId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { AppError } from "../../../../../kernel/http/index.js";
import { businessDayStartUtc } from "../../domain/business-date.js";
import {
  listingNotFound,
  moderationForbidden,
  reportCannotHide,
  reportDailyLimit,
  reportNotConfigured,
  reportOwnListing,
  reportStale,
  reportUnknownReason,
} from "../../domain/errors.js";
import { ListingReport } from "../../domain/listing-report.entity.js";
import type { Listing } from "../../domain/listing.entity.js";
import type {
  DirectoryDependencies,
  DirectoryStaffDependencies,
} from "../directory-dependencies.js";
import { recordListingChange } from "../listing-records.js";
import type {
  ListingReportPage,
  ListingReportQueueGroup,
} from "../ports/listing-report-repository.js";

function toReportResponse(report: ListingReport): ListingReportResponse {
  return {
    listingReportId: report.listingReportId,
    reasonKey: report.reasonKey,
    note: report.note ?? null,
    status: report.status,
    outcome: report.outcome ?? null,
    reporterCustomerAccountId: report.reporterCustomerAccountId,
    createdAt: report.createdAt.toISOString(),
    resolvedAt: report.resolvedAt === undefined ? null : report.resolvedAt.toISOString(),
    resolvedByUserId: report.resolvedByUserId ?? null,
  };
}

async function organizationTimezone(
  dependencies: DirectoryDependencies,
  organizationId: OrganizationId,
): Promise<string> {
  const timeZone = await dependencies.timezones.read(organizationId);
  if (timeZone !== undefined) return timeZone;
  throw new AppError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.missing_tenant_context",
  });
}

/** POST /listings/:listingNumber/reports (M.7 decision 3). 201 new, 200 when the open report exists. */
export class FileListingReportUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly listingNumber: string;
    readonly reporterCustomerAccountId: string;
    readonly body: ListingReportFileRequest;
  }): Promise<{ readonly report: ListingReportResponse; readonly created: boolean }> {
    const directory = await this.dependencies.template.directoryBlockOf(input.organizationId);
    const reasons = directory?.reportReasons ?? [];
    if (reasons.length === 0) throw reportNotConfigured();
    if (!reasons.some((reason) => reason.reasonKey === input.body.reasonKey)) {
      throw reportUnknownReason(input.body.reasonKey);
    }
    const listing = await this.dependencies.listings.findByListingNumber(input.listingNumber);
    // Not APPROVED is 404: a hidden, draft or archived listing is invisible to the caller.
    if (listing === undefined || listing.status !== LISTING_STATUS.APPROVED) {
      throw listingNotFound();
    }
    const reporter = asId<CustomerAccountId>(input.reporterCustomerAccountId);
    if (listing.ownerCustomerAccountId === reporter) throw reportOwnListing();
    return this.dependencies.unitOfWork.run(async () =>
      this.fileInsideTransaction(listing, reporter, input.body),
    );
  }

  private async fileInsideTransaction(
    listing: Listing,
    reporter: CustomerAccountId,
    body: ListingReportFileRequest,
  ): Promise<{ readonly report: ListingReportResponse; readonly created: boolean }> {
    const { reports, clock } = this.dependencies;
    const existing = await reports.findOpenByListingAndReporter(listing.listingId, reporter);
    if (existing !== undefined) return { report: toReportResponse(existing), created: false };
    const timeZone = await organizationTimezone(this.dependencies, listing.organizationId);
    const dayStart = businessDayStartUtc(clock.now(), timeZone);
    const filedToday = await reports.countFiledSince(reporter, dayStart);
    if (filedToday >= DIRECTORY_SAFETY_RULES.reportsPerAccountPerDay) throw reportDailyLimit();
    const report = ListingReport.create({
      organizationId: listing.organizationId,
      listingId: listing.listingId,
      reporterCustomerAccountId: reporter,
      reasonKey: body.reasonKey,
      note: body.note,
      now: clock.now(),
    });
    const inserted = await reports.insert(report);
    if (!inserted) {
      const raced = await reports.findOpenByListingAndReporter(listing.listingId, reporter);
      if (raced === undefined) throw reportStale();
      return { report: toReportResponse(raced), created: false };
    }
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.LISTING_REPORT_FILED,
      entityType: AUDIT_ENTITY_TYPE.listingReport,
      entityId: report.listingReportId,
      changes: { listingId: { to: listing.listingId }, reasonKey: { to: report.reasonKey } },
    });
    await this.dependencies.events.publish(DIRECTORY_EVENT_TYPE.LISTING_REPORT_FILED, {
      listingId: report.listingId,
      listingReportId: report.listingReportId,
      reasonKey: report.reasonKey,
    });
    return { report: toReportResponse(report), created: true };
  }
}

/** GET /listing-report-reasons for the M.6 report form (M.7 decision 1). */
export class GetListingReportReasonsUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
  }): Promise<readonly DirectoryReportReason[]> {
    const directory = await this.dependencies.template.directoryBlockOf(input.organizationId);
    return (directory?.reportReasons ?? []).map((reason) => ({
      reasonKey: reason.reasonKey,
      label: { bn: reason.label.bn, en: reason.label.en },
    }));
  }
}

/** Staff queue: open reports grouped by listing, oldest first (M.7 decision 4). */
export class ListListingReportQueueUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly page: number;
    readonly limit: number;
  }): Promise<ListingReportPage<ListingReportQueueItem>> {
    const groups = await this.dependencies.reports.queueOpenGroups(input.page, input.limit);
    const listings = await this.dependencies.listings.findByIds(
      groups.items.map((group) => group.listingId),
    );
    const listingById = new Map(listings.map((listing) => [listing.listingId, listing]));
    return {
      ...groups,
      items: groups.items.flatMap((group) => toQueueItem(group, listingById.get(group.listingId))),
    };
  }
}

function toQueueItem(
  group: ListingReportQueueGroup,
  listing: Listing | undefined,
): readonly ListingReportQueueItem[] {
  if (listing === undefined) return [];
  return [
    {
      listingId: group.listingId,
      listingNumber: listing.listingNumber,
      listingStatus: listing.status,
      openCount: group.openCount,
      reasonKeys: [...group.reasonKeys].sort(),
      oldestReportAt: group.oldestReportAt.toISOString(),
      newestReportAt: group.newestReportAt.toISOString(),
    },
  ];
}

/** GET /listings/:listingId/reports (M.7 decision 4). Staff never see the reporter's phone. */
export class ListListingReportsUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly listingId: ListingId;
    readonly status?: ListingReportStatus;
    readonly page: number;
    readonly limit: number;
  }): Promise<ListingReportPage<ListingReportResponse>> {
    const listing = await this.dependencies.listings.findById(input.listingId);
    if (listing === undefined) throw listingNotFound();
    const page = await this.dependencies.reports.listForListing({
      listingId: input.listingId,
      ...(input.status === undefined ? {} : { status: input.status }),
      page: input.page,
      limit: input.limit,
    });
    return { ...page, items: page.items.map(toReportResponse) };
  }
}

/** POST /listings/:listingId/reports/resolve (M.7 decision 5). One transaction, all-or-nothing. */
export class ResolveListingReportsUseCase {
  constructor(private readonly dependencies: DirectoryStaffDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly listingId: ListingId;
    readonly body: ListingReportResolveRequest;
    readonly actorUserId: UserId;
  }): Promise<readonly ListingReportResponse[]> {
    await this.requireSecondPermission(input.body.outcome);
    const now = this.dependencies.clock.now();
    const reportIds = input.body.reportIds.map((reportId) => asId<ListingReportId>(reportId));
    return this.dependencies.unitOfWork.run(async () => {
      const listing = await this.dependencies.listings.findById(input.listingId);
      if (listing === undefined) throw listingNotFound();
      await this.refuseStaleReports(input.listingId, reportIds);
      await this.applyOutcome(listing, input.body.outcome, input.actorUserId);
      const closed = await this.dependencies.reports.markResolved({
        reportIds,
        outcome: input.body.outcome,
        actorUserId: input.actorUserId,
        resolutionNote: input.body.note,
        now,
      });
      // A report closed by another staff member in the meantime: nothing is written.
      if (closed !== reportIds.length) throw reportStale();
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.LISTING_REPORTS_RESOLVED,
        entityType: AUDIT_ENTITY_TYPE.listingReport,
        entityId: input.listingId,
        changes: {
          listingId: { to: input.listingId },
          outcome: { to: input.body.outcome },
          count: { to: String(closed) },
        },
      });
      await this.dependencies.events.publish(DIRECTORY_EVENT_TYPE.LISTING_REPORT_RESOLVED, {
        listingId: input.listingId,
        outcome: input.body.outcome,
        reportIds,
        ownerCustomerAccountId: listing.ownerCustomerAccountId,
      });
      const resolved = await this.dependencies.reports.findByIds(reportIds);
      return resolved.map(toReportResponse);
    });
  }

  /** The second permission, asked before any write (M.7 decision 6). */
  private async requireSecondPermission(outcome: ListingReportOutcome): Promise<void> {
    const { moderationAccess } = this.dependencies;
    if (outcome === LISTING_REPORT_OUTCOME.LISTING_HIDDEN && !(await moderationAccess.mayHide())) {
      throw moderationForbidden(PERMISSION_KEY.DIRECTORY_LISTING_HIDE);
    }
    if (
      outcome === LISTING_REPORT_OUTCOME.ACCOUNT_BLOCKED &&
      !(await moderationAccess.mayBlockAccounts())
    ) {
      throw moderationForbidden(PERMISSION_KEY.CONTACT_CUSTOMER_ACCOUNT_BLOCK);
    }
  }

  private async refuseStaleReports(
    listingId: ListingId,
    reportIds: readonly ListingReportId[],
  ): Promise<void> {
    const found = await this.dependencies.reports.findByIds(reportIds);
    const openOfThisListing = found.filter(
      (report) => report.listingId === listingId && report.isOpen(),
    );
    // Unknown, foreign (tenant scoping hides them) or already resolved ids all land here.
    if (openOfThisListing.length !== reportIds.length) throw reportStale();
  }

  private async applyOutcome(
    listing: Listing,
    outcome: ListingReportOutcome,
    actorUserId: UserId,
  ): Promise<void> {
    if (outcome === LISTING_REPORT_OUTCOME.LISTING_HIDDEN) {
      if (listing.status === LISTING_STATUS.HIDDEN) return;
      if (listing.status !== LISTING_STATUS.APPROVED) throw reportCannotHide(listing.status);
      const hidden = await this.dependencies.listings.save(
        listing.hide(this.dependencies.clock.now(), actorUserId),
        listing.version,
        actorUserId,
      );
      await recordListingChange(this.dependencies, {
        action: AUDIT_ACTION.LISTING_CONCEALED,
        before: listing,
        after: hidden,
        eventType: DIRECTORY_EVENT_TYPE.LISTING_HIDDEN,
      });
      return;
    }
    if (outcome === LISTING_REPORT_OUTCOME.ACCOUNT_BLOCKED) {
      // The listing itself is hidden by the blocked-account handler, one path for both (decision 7).
      await this.dependencies.accountBlocker.block({
        organizationId: listing.organizationId,
        customerAccountId: listing.ownerCustomerAccountId,
        actorUserId,
      });
    }
  }
}
