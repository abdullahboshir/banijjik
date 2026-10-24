import type { CurrencyCode } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/accounting";
import type { CommissionSourceType } from "@banijjik/contracts/commission";
import {
  asId,
  type CommissionEntryId,
  type CommissionPayoutId,
  type LocationId,
  type MemberId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type { Model, PipelineStage, QueryFilter } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type {
  CommissionEntryListFilter,
  CommissionEntryRepository,
  CommissionMemberTotals,
  Page,
  OpenEntriesFilter,
  OpenEntriesTotal,
} from "../application/ports/commission-ports.js";
import type { CommissionEntry } from "../domain/commission-entry.entity.js";
import {
  COMMISSION_ENTRY_MODEL_NAME,
  type CommissionEntryDocument,
  type MoneyDocument,
} from "./commission.schema.js";

function entryModel(): Model<CommissionEntryDocument> {
  return models({}).get<CommissionEntryDocument>(COMMISSION_ENTRY_MODEL_NAME);
}

function toMoney(value: MoneyDocument): Money {
  return { amount: value.amount, currency: value.currency };
}

function toUserId(value: string | null): UserId | null {
  return value === null ? null : asId<UserId>(value);
}

function toEntry(row: CommissionEntryDocument): CommissionEntry {
  return {
    commissionEntryId: asId<CommissionEntryId>(row.commissionEntryId),
    organizationId: asId<OrganizationId>(row.organizationId),
    memberId: asId<MemberId>(row.memberId),
    locationId: asId<LocationId>(row.locationId),
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceLineId: row.sourceLineId,
    sourceNumber: row.sourceNumber,
    sequence: row.sequence,
    entryKind: row.entryKind,
    amount: toMoney(row.amount),
    base: toMoney(row.base),
    sourceGrossTotal: toMoney(row.sourceGrossTotal),
    refundedTotalSeen: toMoney(row.refundedTotalSeen),
    ruleSnapshot: {
      commissionRuleId: row.ruleSnapshot.commissionRuleId,
      subjectType: row.ruleSnapshot.subjectType,
      targetType: row.ruleSnapshot.targetType,
      calculation: row.ruleSnapshot.calculation,
      percentBasisPoints: row.ruleSnapshot.percentBasisPoints,
      fixedAmount:
        row.ruleSnapshot.fixedAmount === null ? null : toMoney(row.ruleSnapshot.fixedAmount),
    },
    businessDate: row.businessDate,
    payoutId: row.payoutId === null ? null : asId<CommissionPayoutId>(row.payoutId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: toUserId(row.createdByUserId),
    updatedByUserId: toUserId(row.updatedByUserId),
  };
}

function toDocument(entry: CommissionEntry): CommissionEntryDocument {
  return {
    commissionEntryId: entry.commissionEntryId,
    organizationId: entry.organizationId,
    memberId: entry.memberId,
    locationId: entry.locationId,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    sourceLineId: entry.sourceLineId,
    sourceNumber: entry.sourceNumber,
    sequence: entry.sequence,
    entryKind: entry.entryKind,
    amount: entry.amount,
    base: entry.base,
    sourceGrossTotal: entry.sourceGrossTotal,
    refundedTotalSeen: entry.refundedTotalSeen,
    ruleSnapshot: entry.ruleSnapshot,
    businessDate: entry.businessDate,
    payoutId: entry.payoutId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    createdByUserId: entry.createdByUserId,
    updatedByUserId: entry.updatedByUserId,
  };
}

function listQueryOf(filter: CommissionEntryListFilter): QueryFilter<CommissionEntryDocument> {
  const query: QueryFilter<CommissionEntryDocument> = {};
  if (filter.memberId !== undefined) query.memberId = filter.memberId;
  if (filter.locationId !== undefined) query.locationId = filter.locationId;
  if (filter.from !== undefined || filter.to !== undefined) {
    query.businessDate = {
      ...(filter.from === undefined ? {} : { $gte: filter.from }),
      ...(filter.to === undefined ? {} : { $lte: filter.to }),
    };
  }
  return query;
}

function openQueryOf(input: OpenEntriesFilter): QueryFilter<CommissionEntryDocument> {
  return {
    memberId: input.memberId,
    locationId: input.locationId,
    payoutId: null,
    businessDate: { $lte: input.upToBusinessDate },
    "amount.currency": input.currency,
  };
}

async function sumOf(
  match: QueryFilter<CommissionEntryDocument>,
  currency: CurrencyCode,
): Promise<OpenEntriesTotal> {
  const rows = await entryModel().aggregate<{
    readonly entryCount: number;
    readonly amount: number;
  }>(
    [
      { $match: { ...match, "amount.currency": currency } },
      { $group: { _id: null, entryCount: { $sum: 1 }, amount: { $sum: "$amount.amount" } } },
    ],
    sessionOption(getActiveSession()),
  );
  const row = rows[0];
  return { entryCount: row?.entryCount ?? 0, amount: row?.amount ?? 0 };
}

interface TotalsRow {
  readonly _id: string;
  readonly open: number;
  readonly paid: number;
}

export class MongoCommissionEntryRepository implements CommissionEntryRepository {
  async insertIfAbsent(entry: CommissionEntry): Promise<"inserted" | "exists"> {
    const { organizationId, ...rest } = toDocument(entry);
    // The organization comes from the filter (the tenant plugin refuses to assign it). Timestamps are written by the entry itself: an existing row is never touched, not even its updatedAt.
    const result = await entryModel().updateOne(
      {
        organizationId,
        sourceType: rest.sourceType,
        sourceId: rest.sourceId,
        sourceLineId: rest.sourceLineId,
        memberId: rest.memberId,
        sequence: rest.sequence,
      },
      { $setOnInsert: rest },
      { upsert: true, timestamps: false, ...sessionOption(getActiveSession()) },
    );
    return result.upsertedCount > 0 ? "inserted" : "exists";
  }

  async findById(commissionEntryId: CommissionEntryId): Promise<CommissionEntry | undefined> {
    const row = await entryModel()
      .findOne({ commissionEntryId }, null, sessionOption(getActiveSession()))
      .lean<CommissionEntryDocument>();
    return row === null ? undefined : toEntry(row);
  }

  async listBySource(
    sourceType: CommissionSourceType,
    sourceId: string,
  ): Promise<readonly CommissionEntry[]> {
    const rows = await entryModel()
      .find({ sourceType, sourceId }, null, sessionOption(getActiveSession()))
      .sort({ memberId: 1, sequence: 1 })
      .lean<CommissionEntryDocument[]>();
    return rows.map(toEntry);
  }

  async list(filter: CommissionEntryListFilter): Promise<Page<CommissionEntry>> {
    const rows = await entryModel()
      .find(listQueryOf(filter))
      .sort({ businessDate: -1, commissionEntryId: -1 })
      .skip((filter.page - 1) * filter.limit)
      .limit(filter.limit + 1)
      .lean<CommissionEntryDocument[]>();
    return { items: rows.slice(0, filter.limit).map(toEntry), hasNext: rows.length > filter.limit };
  }

  async summarizeOpen(input: OpenEntriesFilter): Promise<OpenEntriesTotal> {
    return sumOf(openQueryOf(input), input.currency);
  }

  async claimOpen(
    input: OpenEntriesFilter & { readonly payoutId: CommissionPayoutId },
  ): Promise<void> {
    // `payoutId: null` is in the filter, so an entry another payout took is never claimed twice.
    await entryModel().updateMany(
      openQueryOf(input),
      { $set: { payoutId: input.payoutId } },
      { timestamps: false, ...sessionOption(getActiveSession()) },
    );
  }

  async summarizeClaimed(input: {
    readonly memberId: string;
    readonly locationId: string;
    readonly payoutId: CommissionPayoutId;
    readonly currency: CurrencyCode;
  }): Promise<OpenEntriesTotal> {
    const { memberId, locationId, payoutId, currency } = input;
    return sumOf({ memberId, locationId, payoutId }, currency);
  }

  async summarizeByMember(input: {
    readonly locationId?: string | undefined;
    readonly currency: CurrencyCode;
    readonly page: number;
    readonly limit: number;
  }): Promise<Page<CommissionMemberTotals>> {
    const match: QueryFilter<CommissionEntryDocument> = { "amount.currency": input.currency };
    if (input.locationId !== undefined) match.locationId = input.locationId;
    const isOpen = { $eq: ["$payoutId", null] };
    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $group: {
          _id: "$memberId",
          open: { $sum: { $cond: [isOpen, "$amount.amount", 0] } },
          paid: { $sum: { $cond: [isOpen, 0, "$amount.amount"] } },
        },
      },
      { $sort: { _id: 1 } },
      { $skip: (input.page - 1) * input.limit },
      { $limit: input.limit + 1 },
    ];
    const rows = await entryModel().aggregate<TotalsRow>(pipeline);
    const items = rows
      .slice(0, input.limit)
      .map((row) => ({ memberId: row._id, open: row.open, paid: row.paid }));
    return { items, hasNext: rows.length > input.limit };
  }
}
