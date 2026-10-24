import { LISTING_STATUS } from "@banijjik/contracts/directory";
import { asId, newId, type DirectoryListingStatsId, type OrganizationId } from "@banijjik/ids";
import type { Model } from "mongoose";
import { models } from "../../../../kernel/db/index.js";
import type { ApprovedCountGroup, ListingStatsSnapshot } from "../application/listing-stats.js";
import { isSameListingStats } from "../application/listing-stats.js";
import type {
  ListingStatsRepository,
  StoredListingStats,
} from "../application/ports/listing-stats-repository.js";
import { LISTING_MODEL_NAME, type ListingDocument } from "./listing.schema.js";
import { LISTING_STATS_MODEL_NAME, type ListingStatsDocument } from "./listing-stats.schema.js";

interface GroupRow {
  readonly _id: unknown;
  readonly count: number;
}

function listingModel(): Model<ListingDocument> {
  return models({}).get<ListingDocument>(LISTING_MODEL_NAME);
}

function statsModel(): Model<ListingStatsDocument> {
  return models({}).get<ListingStatsDocument>(LISTING_STATS_MODEL_NAME);
}

/** A listing without a value for the statistics field groups under null. */
function optionOf(groupKey: unknown): string | null {
  return groupKey === null || groupKey === undefined ? null : String(groupKey);
}

/**
 * The aggregation runs on the `{ organizationId, status }` prefix of the listing indexes and only
 * projects the statistics field (M.6a decision 4). The field key comes from a validated template
 * (a plain key, no dots and no `$`), so it can name a path safely.
 */
export class MongoListingStatsRepository implements ListingStatsRepository {
  async countApprovedByOption(
    organizationId: OrganizationId,
    fieldKey: string | null,
  ): Promise<ApprovedCountGroup[]> {
    const groupKey = fieldKey === null ? null : `$customFields.${fieldKey}`;
    const rows = await listingModel().aggregate<GroupRow>([
      { $match: { organizationId, status: LISTING_STATUS.APPROVED } },
      { $group: { _id: groupKey, count: { $sum: 1 } } },
    ]);
    return rows.map((row) => ({ option: optionOf(row._id), count: row.count }));
  }

  async find(organizationId: OrganizationId): Promise<StoredListingStats | undefined> {
    const row = await statsModel()
      .findOne({ organizationId }, { approvedCount: 1, countsByOption: 1, fieldKey: 1, _id: 0 })
      .lean<ListingStatsDocument>();
    if (row === null) return undefined;
    return {
      approvedCount: row.approvedCount,
      fieldKey: row.fieldKey,
      countsByOption: row.countsByOption,
    };
  }

  async saveIfChanged(
    organizationId: OrganizationId,
    snapshot: ListingStatsSnapshot,
  ): Promise<boolean> {
    const stored = await this.find(organizationId);
    if (stored !== undefined && isSameListingStats(stored, snapshot)) return false;
    // setDefaultsOnInsert is off: the schema default of `version` would clash with `$inc`.
    await statsModel().updateOne(
      { organizationId },
      {
        $set: {
          approvedCount: snapshot.approvedCount,
          countsByOption: snapshot.countsByOption,
          fieldKey: snapshot.fieldKey,
          computedAt: new Date(),
        },
        $setOnInsert: {
          directoryListingStatsId: asId<DirectoryListingStatsId>(newId()),
          createdByUserId: null,
          updatedByUserId: null,
        },
        $inc: { version: 1 },
      },
      { upsert: true, setDefaultsOnInsert: false },
    );
    return true;
  }
}
