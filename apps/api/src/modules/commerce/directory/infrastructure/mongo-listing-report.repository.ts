import { LISTING_REPORT_STATUS } from "@banijjik/contracts/directory";
import { asId, type CustomerAccountId, type ListingId, type ListingReportId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type {
  ListingReportListRequest,
  ListingReportPage,
  ListingReportQueueGroup,
  ListingReportRepository,
  ResolvedReportUpdate,
} from "../application/ports/listing-report-repository.js";
import type { ListingReport } from "../domain/listing-report.entity.js";
import { toListingReport, toListingReportDocument } from "./listing-report.mapper.js";
import { LISTING_REPORT_MODEL_NAME, type ListingReportDocument } from "./listing-report.schema.js";

interface QueueFacetRow {
  items: {
    _id: string;
    openCount: number;
    reasonKeys: string[];
    oldestReportAt: Date;
    newestReportAt: Date;
  }[];
  total: { value: number }[];
}

function isDuplicateKey(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

export class MongoListingReportRepository implements ListingReportRepository {
  /** False when the unique open-report index rejected it: the reporter already has one (M.7 decision 3). */
  async insert(report: ListingReport): Promise<boolean> {
    try {
      await this.model().create(
        [toListingReportDocument(report)],
        sessionOption(getActiveSession()),
      );
      return true;
    } catch (error) {
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }

  async findOpenByListingAndReporter(
    listingId: ListingId,
    reporterCustomerAccountId: CustomerAccountId,
  ): Promise<ListingReport | undefined> {
    const row = await this.model()
      .findOne(
        { listingId, reporterCustomerAccountId, status: LISTING_REPORT_STATUS.OPEN },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<ListingReportDocument>()
      .exec();
    return row === null ? undefined : toListingReport(row);
  }

  async findByIds(reportIds: readonly ListingReportId[]): Promise<readonly ListingReport[]> {
    if (reportIds.length === 0) return [];
    const rows = await this.model()
      .find(
        { listingReportId: { $in: [...reportIds] } },
        undefined,
        sessionOption(getActiveSession()),
      )
      .lean<ListingReportDocument[]>()
      .exec();
    return rows.map(toListingReport);
  }

  async countFiledSince(
    reporterCustomerAccountId: CustomerAccountId,
    since: Date,
  ): Promise<number> {
    return this.model()
      .countDocuments(
        { reporterCustomerAccountId, createdAt: { $gte: since } },
        sessionOption(getActiveSession()),
      )
      .exec();
  }

  async listForListing(
    request: ListingReportListRequest,
  ): Promise<ListingReportPage<ListingReport>> {
    const filter: Record<string, unknown> = { listingId: request.listingId };
    if (request.status !== undefined) filter["status"] = request.status;
    const skip = (request.page - 1) * request.limit;
    const [rows, total] = await Promise.all([
      this.model()
        .find(filter)
        .sort({ createdAt: -1, listingReportId: 1 })
        .skip(skip)
        .limit(request.limit)
        .lean<ListingReportDocument[]>()
        .exec(),
      this.model().countDocuments(filter).exec(),
    ]);
    return { items: rows.map(toListingReport), total, page: request.page, limit: request.limit };
  }

  async queueOpenGroups(
    page: number,
    limit: number,
  ): Promise<ListingReportPage<ListingReportQueueGroup>> {
    // The tenant plugin puts the organizationId $match first, so this uses the queue index prefix.
    const rows = await this.model().aggregate<QueueFacetRow>([
      { $match: { status: LISTING_REPORT_STATUS.OPEN } },
      {
        $group: {
          _id: "$listingId",
          openCount: { $sum: 1 },
          reasonKeys: { $addToSet: "$reasonKey" },
          oldestReportAt: { $min: "$createdAt" },
          newestReportAt: { $max: "$createdAt" },
        },
      },
      { $sort: { oldestReportAt: 1, _id: 1 } },
      {
        $facet: {
          items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: "value" }],
        },
      },
    ]);
    const facet = rows[0];
    return {
      items: (facet?.items ?? []).map((row) => ({
        listingId: asId<ListingId>(row._id),
        openCount: row.openCount,
        reasonKeys: row.reasonKeys,
        oldestReportAt: row.oldestReportAt,
        newestReportAt: row.newestReportAt,
      })),
      total: facet?.total?.[0]?.value ?? 0,
      page,
      limit,
    };
  }

  async markResolved(update: ResolvedReportUpdate): Promise<number> {
    const result = await this.model().updateMany(
      { listingReportId: { $in: [...update.reportIds] }, status: LISTING_REPORT_STATUS.OPEN },
      {
        $set: {
          status: LISTING_REPORT_STATUS.RESOLVED,
          outcome: update.outcome,
          resolvedByUserId: update.actorUserId,
          resolvedAt: update.now,
          resolutionNote: update.resolutionNote,
          updatedAt: update.now,
          updatedByUserId: update.actorUserId,
        },
        $inc: { version: 1 },
      },
      sessionOption(getActiveSession()),
    );
    return result.modifiedCount;
  }

  private model() {
    return models({}).get<ListingReportDocument>(LISTING_REPORT_MODEL_NAME);
  }
}
