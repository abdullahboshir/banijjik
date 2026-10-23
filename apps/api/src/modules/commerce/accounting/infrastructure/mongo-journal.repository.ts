import type { JournalSourceType, Money, PostingKey } from "@banijjik/contracts/accounting";
import {
  asId,
  type JournalEntryId,
  type LocationId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type { Model, QueryFilter } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
} from "../../../../kernel/db/index.js";
import type {
  JournalListFilter,
  JournalRepository,
} from "../application/ports/journal-repository.js";
import { entryAlreadyReversed } from "../domain/bookkeeping-errors.js";
import { JournalEntry } from "../domain/journal-entry.entity.js";
import { JOURNAL_ENTRY_MODEL_NAME, type JournalEntryDocument } from "./journal-entry.schema.js";

const JOURNAL_PROJECTION =
  "journalEntryId organizationId entryNumber businessDate locationId lines sourceType sourceId postingKey reversesJournalEntryId createdAt createdByUserId memo requestFingerprint operationKey -_id";
function journalModel(): Model<JournalEntryDocument> {
  return models({}).get<JournalEntryDocument>(JOURNAL_ENTRY_MODEL_NAME);
}

function toEntity(row: JournalEntryDocument): JournalEntry {
  return JournalEntry.rehydrate({
    journalEntryId: asId<JournalEntryId>(row.journalEntryId),
    memo: row.memo ?? null,
    requestFingerprint: row.requestFingerprint ?? null,
    operationKey: row.operationKey ?? null,
    organizationId: asId<OrganizationId>(row.organizationId),
    entryNumber: row.entryNumber,
    businessDate: row.businessDate,
    locationId: row.locationId === null ? null : asId<LocationId>(row.locationId),
    // Stored as a plain string; journals are validated against the organization currency on write (ADR-128).
    lines: row.lines.map((line) => ({
      accountId: line.accountId,
      accountCode: line.accountCode,
      debit: { amount: line.debit.amount, currency: line.debit.currency as Money["currency"] },
      credit: { amount: line.credit.amount, currency: line.credit.currency as Money["currency"] },
    })),
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    postingKey: row.postingKey,
    reversesJournalEntryId:
      row.reversesJournalEntryId === null ? null : asId<JournalEntryId>(row.reversesJournalEntryId),
    createdAt: row.createdAt,
    createdByUserId: row.createdByUserId === null ? null : asId<UserId>(row.createdByUserId),
  });
}

export class MongoJournalRepository implements JournalRepository {
  async findManualOperation(operationKey: string): Promise<JournalEntry | undefined> {
    const row = await journalModel()
      .findOne(
        { sourceType: "MANUAL", operationKey, reversesJournalEntryId: null },
        JOURNAL_PROJECTION,
        sessionOption(getActiveSession()),
      )
      .lean<JournalEntryDocument>();
    return row === null ? undefined : toEntity(row);
  }

  async aggregateBalances(filter: {
    from?: string | undefined;
    to: string;
    locationId?: string | undefined;
  }): Promise<readonly { accountId: string; debit: number; credit: number }[]> {
    return journalModel().aggregate([
      {
        $match: {
          businessDate: {
            $lte: filter.to,
            ...(filter.from === undefined ? {} : { $gte: filter.from }),
          },
          ...(filter.locationId === undefined ? {} : { locationId: filter.locationId }),
        },
      },
      { $unwind: "$lines" },
      {
        $group: {
          _id: "$lines.accountId",
          debit: { $sum: "$lines.debit.amount" },
          credit: { $sum: "$lines.credit.amount" },
        },
      },
      { $project: { _id: 0, accountId: "$_id", debit: 1, credit: 1 } },
    ]);
  }

  async insert(entry: JournalEntry): Promise<"inserted" | "duplicate"> {
    try {
      await journalModel().create(
        [
          {
            journalEntryId: entry.journalEntryId,
            memo: entry.memo,
            requestFingerprint: entry.requestFingerprint,
            operationKey: entry.operationKey,
            organizationId: entry.organizationId,
            entryNumber: entry.entryNumber,
            businessDate: entry.businessDate,
            locationId: entry.locationId,
            lines: entry.lines.map((line) => ({ ...line })),
            sourceType: entry.sourceType,
            sourceId: entry.sourceId,
            postingKey: entry.postingKey,
            reversesJournalEntryId: entry.reversesJournalEntryId,
            createdAt: entry.createdAt,
            createdByUserId: entry.createdByUserId,
            updatedAt: entry.createdAt,
            updatedByUserId: entry.createdByUserId,
          },
        ],
        sessionOption(getActiveSession()),
      );
      return "inserted";
    } catch (error) {
      if (isDuplicateKeyError(error, "reversesJournalEntryId")) throw entryAlreadyReversed();
      if (isDuplicateKeyError(error, "sourceId") || isDuplicateKeyError(error, "operationKey"))
        return "duplicate";
      throw error;
    }
  }

  async findById(journalEntryId: JournalEntryId): Promise<JournalEntry | undefined> {
    const row = await journalModel()
      .findOne({ journalEntryId }, JOURNAL_PROJECTION, sessionOption(getActiveSession()))
      .lean<JournalEntryDocument>();
    return row === null ? undefined : toEntity(row);
  }

  async findBySource(input: {
    readonly sourceType: JournalSourceType;
    readonly sourceId: string;
    readonly postingKey: PostingKey;
  }): Promise<JournalEntry | undefined> {
    const row = await journalModel()
      .findOne(input, JOURNAL_PROJECTION, sessionOption(getActiveSession()))
      .lean<JournalEntryDocument>();
    return row === null ? undefined : toEntity(row);
  }

  async list(
    filter: JournalListFilter,
  ): Promise<{ readonly items: JournalEntry[]; readonly hasNext: boolean }> {
    const query: QueryFilter<JournalEntryDocument> = {};
    if (filter.from !== undefined || filter.to !== undefined) {
      query.businessDate = {
        ...(filter.from === undefined ? {} : { $gte: filter.from }),
        ...(filter.to === undefined ? {} : { $lte: filter.to }),
      };
    }
    if (filter.accountId !== undefined) query["lines.accountId"] = filter.accountId;
    if (filter.sourceType !== undefined) query.sourceType = filter.sourceType;
    const rows = await journalModel()
      .find(query)
      .select(JOURNAL_PROJECTION)
      .sort({ businessDate: 1, entryNumber: 1 })
      .skip((filter.page - 1) * filter.limit)
      .limit(filter.limit + 1)
      .lean<JournalEntryDocument[]>();
    const hasNext = rows.length > filter.limit;
    return { items: rows.slice(0, filter.limit).map(toEntity), hasNext };
  }

  async listThrough(asOf: string): Promise<JournalEntry[]> {
    const rows = await journalModel()
      .find({ businessDate: { $lte: asOf } })
      .select(JOURNAL_PROJECTION)
      .lean<JournalEntryDocument[]>();
    return rows.map(toEntity);
  }
}
