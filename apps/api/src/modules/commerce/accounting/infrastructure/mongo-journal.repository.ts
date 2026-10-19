import type { JournalSourceType, PostingKey } from "@banijjik/contracts/accounting";
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
import { JournalEntry } from "../domain/journal-entry.entity.js";
import { JOURNAL_ENTRY_MODEL_NAME, type JournalEntryDocument } from "./journal-entry.schema.js";

function journalModel(): Model<JournalEntryDocument> {
  return models({}).get<JournalEntryDocument>(JOURNAL_ENTRY_MODEL_NAME);
}

function toEntity(row: JournalEntryDocument): JournalEntry {
  return JournalEntry.rehydrate({
    journalEntryId: asId<JournalEntryId>(row.journalEntryId),
    organizationId: asId<OrganizationId>(row.organizationId),
    entryNumber: row.entryNumber,
    businessDate: row.businessDate,
    locationId: row.locationId === null ? null : asId<LocationId>(row.locationId),
    lines: row.lines.map((line) => ({
      accountId: line.accountId,
      accountCode: line.accountCode,
      debit: { amount: line.debit.amount, currency: line.debit.currency as "BDT" },
      credit: { amount: line.credit.amount, currency: line.credit.currency as "BDT" },
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
  async insert(entry: JournalEntry): Promise<"inserted" | "duplicate"> {
    try {
      await journalModel().create(
        [
          {
            journalEntryId: entry.journalEntryId,
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
      if (isDuplicateKeyError(error, "sourceId")) return "duplicate";
      throw error;
    }
  }

  async findById(journalEntryId: JournalEntryId): Promise<JournalEntry | undefined> {
    const row = await journalModel().findOne({ journalEntryId }).lean<JournalEntryDocument>();
    return row === null ? undefined : toEntity(row);
  }

  async findBySource(input: {
    readonly sourceType: JournalSourceType;
    readonly sourceId: string;
    readonly postingKey: PostingKey;
  }): Promise<JournalEntry | undefined> {
    const row = await journalModel().findOne(input).lean<JournalEntryDocument>();
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
    if (filter.sourceType !== undefined) query.sourceType = filter.sourceType;
    const rows = await journalModel()
      .find(query)
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
      .lean<JournalEntryDocument[]>();
    return rows.map(toEntity);
  }
}
