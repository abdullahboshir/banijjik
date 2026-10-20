import type { CustomerAccountId } from "@banijjik/ids";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type {
  CreditRepository,
  UpdateBalanceInput,
} from "../application/ports/credit-repository.js";
import type { CreditEntry, CreditBalance } from "../domain/index.js";
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
    await Model.create([this.entryToDocument(entry)], sessionOption(getActiveSession()));
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
      .limit(options.limit);
    return docs.map((d: CreditEntryDocument) => this.entryFromDocument(d));
  }

  async getBalance(customerAccountId: CustomerAccountId): Promise<CreditBalance | null> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<CreditBalanceDocument>(CREDIT_BALANCE_MODEL_NAME);
    const doc = await Model.findOne({ organizationId, customerAccountId });
    return doc ? this.balanceFromDocument(doc) : null;
  }

  async insertBalance(balance: CreditBalance): Promise<void> {
    const Model = models({ organizationId: getOrganizationId() }).get<CreditBalanceDocument>(
      CREDIT_BALANCE_MODEL_NAME,
    );
    await Model.create([this.balanceToDocument(balance)], sessionOption(getActiveSession()));
  }

  async updateBalance(input: UpdateBalanceInput): Promise<CreditBalance> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<CreditBalanceDocument>(CREDIT_BALANCE_MODEL_NAME);
    const doc = await Model.findOneAndUpdate(
      {
        organizationId,
        customerAccountId: input.customerAccountId,
        version: input.expectedVersion,
      },
      {
        $inc: { balance: input.delta, version: 1 },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    );
    if (!doc) {
      throw new Error("Balance not found or version mismatch");
    }
    if (doc.balance < 0) {
      throw new Error("Balance cannot go negative");
    }
    return this.balanceFromDocument(doc);
  }

  async findPurchaseEntry(purchaseEntryId: string): Promise<CreditEntry | null> {
    const organizationId = getOrganizationId();
    const Model = models({ organizationId }).get<CreditEntryDocument>(CREDIT_ENTRY_MODEL_NAME);
    const doc = await Model.findOne({
      organizationId,
      creditEntryId: purchaseEntryId,
    });
    return doc ? this.entryFromDocument(doc) : null;
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

  private balanceToDocument(balance: CreditBalance): CreditBalanceDocument {
    const organizationId = getOrganizationId();
    return {
      customerAccountId: balance.customerAccountId,
      organizationId,
      balance: balance.balance,
      version: balance.version,
      updatedAt: new Date(balance.updatedAt),
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
