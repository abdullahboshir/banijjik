import { LISTING_STATUS, type ListingStatus } from "@banijjik/contracts/directory";
import type { CustomerAccountId, ListingId, UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  ListingPage,
  ListingQueueRequest,
  ListingRepository,
  ListingSearchFilter,
  ListingSearchRequest,
  ListingStaffListRequest,
} from "../application/ports/listing-repository.js";
import type { Listing } from "../domain/listing.entity.js";
import { listingConflict } from "../domain/errors.js";
import { toListing, toListingDocument } from "./listing.mapper.js";
import { LISTING_MODEL_NAME, type ListingDocument } from "./listing.schema.js";

const ACTIVE_STATUSES: readonly ListingStatus[] = [
  LISTING_STATUS.DRAFT,
  LISTING_STATUS.SUBMITTED,
  LISTING_STATUS.APPROVED,
  LISTING_STATUS.REJECTED,
  LISTING_STATUS.HIDDEN,
];

function filterBranches(filters: readonly ListingSearchFilter[]): object[] {
  return filters.map((filter) => {
    if (filter.anyOf !== undefined && filter.anyOf.length > 0) {
      return {
        customFieldSearch: {
          $elemMatch: { fieldKey: filter.fieldKey, value: { $in: [...filter.anyOf] } },
        },
      };
    }
    if (filter.minValue !== undefined || filter.maxValue !== undefined) {
      const range: Record<string, string> = {};
      if (filter.minValue !== undefined) range["$gte"] = filter.minValue;
      if (filter.maxValue !== undefined) range["$lte"] = filter.maxValue;
      return {
        customFieldSearch: { $elemMatch: { fieldKey: filter.fieldKey, value: range } },
      };
    }
    return {
      customFieldSearch: {
        $elemMatch: { fieldKey: filter.fieldKey, value: filter.value },
      },
    };
  });
}

function searchFilter(request: ListingSearchRequest): object {
  const parts: object[] = [{ status: LISTING_STATUS.APPROVED }];
  if (request.listingNumber !== undefined) {
    parts.push({ listingNumber: request.listingNumber });
  }
  parts.push(...filterBranches(request.filters));
  const [only] = parts;
  return parts.length === 1 && only !== undefined ? only : { $and: parts };
}

export class MongoListingRepository implements ListingRepository {
  async insert(listing: Listing): Promise<void> {
    try {
      await this.model().create([toListingDocument(listing)], sessionOption(getActiveSession()));
    } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw listingConflict();
      }
      throw error;
    }
  }

  async save(
    listing: Listing,
    expectedVersion: number,
    actorUserId: UserId | null,
  ): Promise<Listing> {
    const document = toListingDocument(listing);
    const saved = await updateVersioned<ListingDocument>({
      model: this.model(),
      filter: { listingId: listing.listingId },
      expectedVersion,
      update: {
        $set: {
          status: document.status,
          customFields: document.customFields,
          customFieldSearch: document.customFieldSearch,
          photoFileIds: document.photoFileIds,
          consentsAccepted: document.consentsAccepted,
          submittedAt: document.submittedAt,
          reviewedAt: document.reviewedAt,
          reviewedByUserId: document.reviewedByUserId,
          rejection: document.rejection,
          publishedAt: document.publishedAt,
          updatedByUserId: actorUserId,
        },
        $unset: {
          ...(document.submittedAt === undefined ? { submittedAt: 1 } : {}),
          ...(document.reviewedAt === undefined ? { reviewedAt: 1 } : {}),
          ...(document.reviewedByUserId === undefined ? { reviewedByUserId: 1 } : {}),
          ...(document.rejection === undefined ? { rejection: 1 } : {}),
          ...(document.publishedAt === undefined ? { publishedAt: 1 } : {}),
        },
      },
    });
    return toListing(saved);
  }

  async findById(listingId: ListingId): Promise<Listing | undefined> {
    const row = await this.model().findOne({ listingId }).lean<ListingDocument>().exec();
    return row === null ? undefined : toListing(row);
  }

  async findByListingNumber(listingNumber: string): Promise<Listing | undefined> {
    const row = await this.model().findOne({ listingNumber }).lean<ListingDocument>().exec();
    return row === null ? undefined : toListing(row);
  }

  async findActiveByOwner(ownerCustomerAccountId: CustomerAccountId): Promise<Listing | undefined> {
    const row = await this.model()
      .findOne({ ownerCustomerAccountId, status: { $in: [...ACTIVE_STATUSES] } })
      .lean<ListingDocument>()
      .exec();
    return row === null ? undefined : toListing(row);
  }

  async searchApproved(request: ListingSearchRequest): Promise<ListingPage<Listing>> {
    const filter = searchFilter(request);
    const skip = (request.page - 1) * request.limit;
    const [items, total] = await Promise.all([
      this.model()
        .find(filter)
        .sort({ publishedAt: -1, listingId: 1 })
        .skip(skip)
        .limit(request.limit)
        .lean<ListingDocument[]>()
        .exec(),
      this.model().countDocuments(filter).exec(),
    ]);
    return {
      items: items.map(toListing),
      total,
      page: request.page,
      limit: request.limit,
    };
  }

  async listQueue(request: ListingQueueRequest): Promise<ListingPage<Listing>> {
    const filter =
      request.status === undefined
        ? { status: LISTING_STATUS.SUBMITTED }
        : { status: request.status };
    const skip = (request.page - 1) * request.limit;
    const sort: Record<string, 1 | -1> =
      request.status === LISTING_STATUS.SUBMITTED || request.status === undefined
        ? { submittedAt: 1, listingId: 1 }
        : { updatedAt: -1, listingId: 1 };
    const [items, total] = await Promise.all([
      this.model()
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(request.limit)
        .lean<ListingDocument[]>()
        .exec(),
      this.model().countDocuments(filter).exec(),
    ]);
    return {
      items: items.map(toListing),
      total,
      page: request.page,
      limit: request.limit,
    };
  }

  async listStaff(request: ListingStaffListRequest): Promise<ListingPage<Listing>> {
    const dateField = request.status === LISTING_STATUS.APPROVED ? "publishedAt" : "submittedAt";
    const filter: Record<string, unknown> = {};
    if (request.status !== undefined) filter["status"] = request.status;
    if (request.listingNumber !== undefined) filter["listingNumber"] = request.listingNumber;
    if (request.from !== undefined || request.to !== undefined) {
      const range: Record<string, Date> = {};
      if (request.from !== undefined) range["$gte"] = request.from;
      if (request.to !== undefined) range["$lte"] = request.to;
      filter[dateField] = range;
    }
    const skip = (request.page - 1) * request.limit;
    const sort: Record<string, 1 | -1> = { [dateField]: -1, listingId: 1 };
    const [items, total] = await Promise.all([
      this.model()
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(request.limit)
        .lean<ListingDocument[]>()
        .exec(),
      this.model().countDocuments(filter).exec(),
    ]);
    return {
      items: items.map(toListing),
      total,
      page: request.page,
      limit: request.limit,
    };
  }

  async explainSearch(
    request: ListingSearchRequest,
  ): Promise<{ readonly usesAttributeIndex: boolean }> {
    const filter = searchFilter(request);
    const explained = await this.model().find(filter).explain("queryPlanner");
    const text = JSON.stringify(explained);
    return {
      usesAttributeIndex:
        text.includes("customFieldSearch.fieldKey") || text.includes("customFieldSearch_1"),
    };
  }

  private model() {
    return models({}).get<ListingDocument>(LISTING_MODEL_NAME);
  }
}
