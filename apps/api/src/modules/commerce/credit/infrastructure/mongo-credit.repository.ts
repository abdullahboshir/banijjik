import type { CustomerAccountId } from "@banijjik/ids";
import { getRequestContext } from "../../../../kernel/context/index.js";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
} from "../../../../kernel/db/index.js";
import type { ApplyDeltaInput, CreditRepository } from "../application/ports/credit-repository.js";
import {
  CreditEntryAlreadyExistsError,
  type CreditEntry,
  type CreditBalance,
} from "../domain/index.js";
import { CREDIT_ENTRY_TYPE } from "@banijjik/contracts/credit";
import { CREDIT_ENTRY_MODEL_NAME, type CreditEntryDocument } from "./credit-entry.schema.js";
import { CREDIT_BALANCE_MODEL_NAME, type CreditBalanceDocument } from "./credit-balance.schema.js";

function getOrganizationId(): string {
  const context = getRequestContext();
  if (!context.organizationId) {
    throw new Error("Organization context required");
  }
  return context.organizationId;
}

export class MongoCreditRepository implements CreditRepository {
  async insertEntry(entry: CreditEntry): Promise<void> {
    const Model = models({ organizationId: getOrganizationId() }).get<CreditEntryDocument>(
      CREDIT_ENTRY_MODEL_NAME,
    );
    try {
      await Model.create([this.entryToDocument(entry)], sessionOption(getActiveSession()));
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new CreditEntryAlreadyExistsError();
      throw error;
    }
  }

  async listEntries(
    customerAccountId: CustomerAccountId,
    options: { limit: number; offset: number },
  ): Promise<readonly CreditEntry[]> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<CreditEntryDocument>(CREDIT_ENTRY_MODEL_NAME);
    const docs = await Model.find({ organizationId, customerAccountId })
      .sort({ occurredAt: -1 })
      .skip(options.offset)
      .limit(options.limit)
      .lean();
    return docs.map((d) => this.entryFromDocument(d as CreditEntryDocument));
  }

  async getBalance(customerAccountId: CustomerAccountId): Promise<CreditBalance | null> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<CreditBalanceDocument>(CREDIT_BALANCE_MODEL_NAME);
    const doc = await Model.findOne({ organizationId, customerAccountId }).lean();
    return doc ? this.balanceFromDocument(doc as CreditBalanceDocument) : null;
  }

  async applyDelta(input: ApplyDeltaInput): Promise<CreditBalance | null> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<CreditBalanceDocument>(CREDIT_BALANCE_MODEL_NAME);
    const filter =
      input.delta < 0
        ? {
            organizationId,
            customerAccountId: input.customerAccountId,
            balance: { $gte: -input.delta },
          }
        : { organizationId, customerAccountId: input.customerAccountId };
    const doc = await Model.findOneAndUpdate(
      filter,
      {
        $inc: { balance: input.delta, version: 1 },
        $set: { updatedAt: new Date() },
      },
      {
        new: true,
        upsert: input.delta > 0,
        ...sessionOption(getActiveSession()),
      },
    ).lean<CreditBalanceDocument>();
    return doc ? this.balanceFromDocument(doc) : null;
  }

  async listPurchases(customerAccountId: CustomerAccountId): Promise<readonly CreditEntry[]> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<CreditEntryDocument>(CREDIT_ENTRY_MODEL_NAME);
    const docs = await Model.find({
      organizationId,
      customerAccountId,
      type: CREDIT_ENTRY_TYPE.PURCHASE,
    })
      .sort({ occurredAt: 1 })
      .limit(1000)
      .lean();
    return docs.map((d) => this.entryFromDocument(d as CreditEntryDocument));
  }

  async sumSpendsByPurchase(
    customerAccountId: CustomerAccountId,
    purchaseEntryIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    if (purchaseEntryIds.length === 0) return new Map();
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<CreditEntryDocument>(CREDIT_ENTRY_MODEL_NAME);
    const rows = await Model.aggregate<{ _id: string; total: number }>([
      {
        $match: {
          organizationId,
          customerAccountId,
          type: CREDIT_ENTRY_TYPE.SPEND,
          fromPurchaseEntryId: { $in: purchaseEntryIds },
        },
      },
      { $group: { _id: "$fromPurchaseEntryId", total: { $sum: { $abs: "$credits" } } } },
    ]);
    return new Map(rows.map((row) => [row._id, row.total]));
  }

  async listExpiringPurchases(today: string): Promise<readonly CreditEntry[]> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<CreditEntryDocument>(CREDIT_ENTRY_MODEL_NAME);
    const docs = await Model.find({
      organizationId,
      type: CREDIT_ENTRY_TYPE.PURCHASE,
      expiresOn: { $ne: null, $lt: new Date(today) },
    })
      .sort({ occurredAt: 1 })
      .limit(1000)
      .lean();
    return docs.map((d) => this.entryFromDocument(d as CreditEntryDocument));
  }

  async findPurchaseEntry(purchaseEntryId: string): Promise<CreditEntry | null> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<CreditEntryDocument>(CREDIT_ENTRY_MODEL_NAME);
    const doc = await Model.findOne({
      organizationId,
      creditEntryId: purchaseEntryId,
    }).lean();
    return doc ? this.entryFromDocument(doc as CreditEntryDocument) : null;
  }

  private entryToDocument(entry: CreditEntry): CreditEntryDocument {
    const organizationId = getOrganizationId();
    return {
      creditEntryId: entry.creditEntryId,
      organizationId,
      customerAccountId: entry.customerAccountId,
      type: entry.type,
      credits: entry.credits,
      expiresOn: entry.expiresOn ? new Date(entry.expiresOn) : null,
      source: entry.source,
      fromPurchaseEntryId: entry.fromPurchaseEntryId,
      reason: entry.reason,
      createdByUserId: entry.createdByUserId,
      occurredAt: new Date(entry.occurredAt),
      businessDate: entry.businessDate,
      createdAt: new Date(entry.createdAt),
    };
  }

  private entryFromDocument(doc: CreditEntryDocument): CreditEntry {
    return {
      creditEntryId: doc.creditEntryId,
      customerAccountId: doc.customerAccountId as CustomerAccountId,
      type: doc.type,
      credits: doc.credits,
      expiresOn: doc.expiresOn?.toISOString() ?? null,
      source: doc.source,
      fromPurchaseEntryId: doc.fromPurchaseEntryId,
      reason: doc.reason,
      createdByUserId: doc.createdByUserId,
      occurredAt: doc.occurredAt.toISOString(),
      businessDate: doc.businessDate,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  private balanceFromDocument(doc: CreditBalanceDocument): CreditBalance {
    return {
      customerAccountId: doc.customerAccountId as CustomerAccountId,
      balance: doc.balance,
      version: doc.version,
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
