import type { CustomerAccountId } from "@banijjik/ids";
import {
  getActiveSession,
  getRequestContext,
  models,
  sessionOption,
} from "../../../../kernel/db/index.js";
import type {
  CreditRepository,
  UpdateBalanceInput,
} from "../application/ports/credit-repository.js";
import type { CreditEntry } from "../../domain/credit-entry.entity.js";
import type { CreditBalance } from "../../domain/credit-balance.entity.js";
import { CREDIT_ENTRY_MODEL_NAME, type CreditEntryDocument } from "./credit-entry.schema.js";
import { CREDIT_BALANCE_MODEL_NAME, type CreditBalanceDocument } from "./credit-balance.schema.js";

export class MongoCreditRepository implements CreditRepository {
  async insertEntry(entry: CreditEntry): Promise<void> {
    await this.entryModel().create(
      [this.entryToDocument(entry)],
      sessionOption(getActiveSession()),
    );
  }

  async listEntries(
    customerAccountId: CustomerAccountId,
    options: { limit: number; offset: number },
  ): Promise<readonly CreditEntry[]> {
    const organizationId = getRequestContext().organizationId;
    const docs = await this.entryModel()
      .find({ organizationId, customerAccountId })
      .sort({ occurredAt: -1 })
      .skip(options.offset)
      .limit(options.limit);
    return docs.map((d) => this.entryFromDocument(d));
  }

  async getBalance(customerAccountId: CustomerAccountId): Promise<CreditBalance | null> {
    const organizationId = getRequestContext().organizationId;
    const doc = await this.balanceModel().findOne({ organizationId, customerAccountId });
    return doc ? this.balanceFromDocument(doc) : null;
  }

  async insertBalance(balance: CreditBalance): Promise<void> {
    await this.balanceModel().create(
      [this.balanceToDocument(balance)],
      sessionOption(getActiveSession()),
    );
  }

  async updateBalance(input: UpdateBalanceInput): Promise<CreditBalance> {
    const organizationId = getRequestContext().organizationId;
    const doc = await this.balanceModel().findOneAndUpdate(
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
    const organizationId = getRequestContext().organizationId;
    const doc = await this.entryModel().findOne({
      organizationId,
      creditEntryId: purchaseEntryId,
    });
    return doc ? this.entryFromDocument(doc) : null;
  }

  private entryModel() {
    return models(CREDIT_ENTRY_MODEL_NAME);
  }

  private balanceModel() {
    return models(CREDIT_BALANCE_MODEL_NAME);
  }

  private entryToDocument(entry: CreditEntry): CreditEntryDocument {
    const organizationId = getRequestContext().organizationId;
    return {
      creditEntryId: entry.creditEntryId,
      organizationId,
      customerAccountId: entry.customerAccountId,
      type: entry.type,
      credits: entry.credits,
      expiresOn: entry.expiresOn ? new Date(entry.expiresOn) : null,
      source: entry.source,
      fromPurchaseEntryId: null,
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
      reason: doc.reason,
      createdByUserId: doc.createdByUserId,
      occurredAt: doc.occurredAt.toISOString(),
      businessDate: doc.businessDate,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  private balanceToDocument(balance: CreditBalance): CreditBalanceDocument {
    const organizationId = getRequestContext().organizationId;
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

  private getRequestContext() {
    return getRequestContext();
  }
}
