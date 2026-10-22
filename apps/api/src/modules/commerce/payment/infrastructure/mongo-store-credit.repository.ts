import type { CurrencyCode } from "@banijjik/contracts";
import {
  asId,
  type ContactId,
  type OrganizationId,
  type StoreCreditEntryId,
  type UserId,
} from "@banijjik/ids";
import type { Model, QueryFilter } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import { StoreCreditEntry } from "../domain/store-credit-entry.entity.js";
import type {
  ListStoreCreditFilter,
  PaginatedResult,
  StoreCreditRepository,
} from "../application/ports/payment-repositories.js";
import {
  STORE_CREDIT_ENTRY_MODEL_NAME,
  type StoreCreditEntryDocument,
} from "./store-credit-entry.schema.js";

function getStoreCreditModel(): Model<StoreCreditEntryDocument> {
  return models({}).get<StoreCreditEntryDocument>(STORE_CREDIT_ENTRY_MODEL_NAME);
}

function toDomain(doc: StoreCreditEntryDocument): StoreCreditEntry {
  return StoreCreditEntry.create({
    storeCreditEntryId: asId<StoreCreditEntryId>(doc.storeCreditEntryId),
    organizationId: asId<OrganizationId>(doc.organizationId),
    contactId: asId<ContactId>(doc.contactId),
    direction: doc.direction,
    kind: doc.kind,
    amount: {
      amount: doc.amount.amount,
      currency: doc.amount.currency as CurrencyCode,
    },
    paymentId: doc.paymentId,
    balanceAfterMinor: doc.balanceAfterMinor,
    note: doc.note,
    expiresAt: doc.expiresAt,
    expiresStoreCreditEntryId: doc.expiresStoreCreditEntryId ?? null,
    createdAt: doc.createdAt,
    createdByUserId: doc.createdByUserId ? asId<UserId>(doc.createdByUserId) : null,
  });
}

export class MongoStoreCreditRepository implements StoreCreditRepository {
  async create(entry: StoreCreditEntry): Promise<StoreCreditEntry> {
    const props = entry.toProps();
    const doc: StoreCreditEntryDocument = {
      storeCreditEntryId: props.storeCreditEntryId,
      organizationId: props.organizationId,
      contactId: props.contactId,
      direction: props.direction,
      kind: props.kind,
      amount: {
        amount: props.amount.amount,
        currency: props.amount.currency,
      },
      paymentId: props.paymentId,
      balanceAfterMinor: props.balanceAfterMinor,
      note: props.note,
      expiresAt: props.expiresAt,
      expiresStoreCreditEntryId: props.expiresStoreCreditEntryId ?? null,
      createdAt: props.createdAt,
      createdByUserId: props.createdByUserId,
    };
    await getStoreCreditModel().create([doc], sessionOption(getActiveSession()));
    return entry;
  }

  async findById(
    organizationId: OrganizationId,
    storeCreditEntryId: StoreCreditEntryId,
  ): Promise<StoreCreditEntry | undefined> {
    const row = await getStoreCreditModel()
      .findOne({ organizationId, storeCreditEntryId })
      .lean<StoreCreditEntryDocument>();
    return row ? toDomain(row) : undefined;
  }

  async listByContact(filter: ListStoreCreditFilter): Promise<PaginatedResult<StoreCreditEntry>> {
    const query: QueryFilter<StoreCreditEntryDocument> = {
      organizationId: filter.organizationId,
      contactId: filter.contactId,
    };
    const skip = (filter.page - 1) * filter.limit;
    const model = getStoreCreditModel();
    const [rows, total] = await Promise.all([
      model
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filter.limit)
        .lean<StoreCreditEntryDocument[]>(),
      model.countDocuments(query),
    ]);

    return {
      items: rows.map(toDomain),
      total,
      page: filter.page,
      limit: filter.limit,
    };
  }

  async listExpiredUnprocessed(
    organizationId: OrganizationId,
    now: Date,
  ): Promise<readonly StoreCreditEntry[]> {
    const model = getStoreCreditModel();
    const expiredEntries = await model
      .find({
        organizationId,
        expiresAt: { $ne: null, $lte: now },
        direction: "CREDIT",
      })
      .lean<StoreCreditEntryDocument[]>();

    if (expiredEntries.length === 0) return [];

    const candidateIds = expiredEntries.map((e) => e.storeCreditEntryId);
    const alreadyProcessedEntries = await model
      .find({
        organizationId,
        expiresStoreCreditEntryId: { $in: candidateIds },
      })
      .select({ expiresStoreCreditEntryId: 1 })
      .lean<StoreCreditEntryDocument[]>();

    const alreadyProcessedSet = new Set(
      alreadyProcessedEntries
        .map((e) => e.expiresStoreCreditEntryId)
        .filter((id): id is string => Boolean(id)),
    );

    const unprocessed = expiredEntries.filter(
      (e) => !alreadyProcessedSet.has(e.storeCreditEntryId),
    );
    return unprocessed.map(toDomain);
  }
}
