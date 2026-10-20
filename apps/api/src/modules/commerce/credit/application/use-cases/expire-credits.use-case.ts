import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { CREDIT_ENTRY_TYPE, CREDIT_SOURCE_TYPE } from "@banijjik/contracts/credit";
import { CreditEntryEntity } from "../../domain/credit-entry.entity.js";

export class ExpireCreditsUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(): Promise<void> {
    const today = this.deps.clock.now().toISOString().split("T")[0];
    const expiredPurchases = await this.findExpiredPurchases(today);

    for (const { creditEntryId, customerAccountId } of expiredPurchases) {
      const unused = await this.calculateUnusedCredits(creditEntryId);
      if (unused > 0) {
        await this.createExpiryEntry({
          customerAccountId,
          credits: unused,
          fromPurchaseEntryId: creditEntryId,
          businessDate: today,
        });
      }
    }
  }

  private async findExpiredPurchases(
    today: string,
  ): Promise<readonly { creditEntryId: string; customerAccountId: string }[]> {
    const entries = await this.deps.credit.listEntries("", { limit: 1000, offset: 0 });
    return entries
      .filter((e) => e.type === CREDIT_ENTRY_TYPE.PURCHASE && e.expiresOn && e.expiresOn < today)
      .map((e) => ({ creditEntryId: e.creditEntryId, customerAccountId: e.customerAccountId }));
  }

  private async calculateUnusedCredits(purchaseEntryId: string): Promise<number> {
    const purchase = await this.deps.credit.findPurchaseEntry(purchaseEntryId);
    if (!purchase) return 0;

    const spends = await this.findSpendsAttributedTo(purchaseEntryId);
    return purchase.credits - spends;
  }

  private async findSpendsAttributedTo(purchaseEntryId: string): Promise<number> {
    const entries = await this.deps.credit.listEntries("", { limit: 1000, offset: 0 });
    return entries
      .filter(
        (e) => e.type === CREDIT_ENTRY_TYPE.SPEND && e.fromPurchaseEntryId === purchaseEntryId,
      )
      .reduce((sum, e) => sum + Math.abs(e.credits), 0);
  }

  private async createExpiryEntry(input: {
    customerAccountId: string;
    credits: number;
    fromPurchaseEntryId: string;
    businessDate: string;
  }): Promise<void> {
    const creditEntryId = newId();
    const entry = CreditEntryEntity.create({
      creditEntryId,
      customerAccountId: input.customerAccountId,
      type: CREDIT_ENTRY_TYPE.EXPIRE,
      credits: input.credits,
      expiresOn: null,
      source: { sourceType: CREDIT_SOURCE_TYPE.EXPIRY_JOB, sourceId: input.fromPurchaseEntryId },
      fromPurchaseEntryId: null,
      reason: null,
      createdByUserId: null,
      occurredAt: this.deps.clock.now(),
      businessDate: input.businessDate,
    });
    await this.deps.credit.insertEntry(entry);
  }
}
