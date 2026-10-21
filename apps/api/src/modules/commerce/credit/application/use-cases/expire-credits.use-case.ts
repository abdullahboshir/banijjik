import {
  CREDIT_ENTRY_TYPE,
  CREDIT_EVENT_TYPE,
  CREDIT_SOURCE_TYPE,
} from "@banijjik/contracts/credit";
import { newId, type CustomerAccountId } from "@banijjik/ids";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { CreditEntryAlreadyExistsError, type CreditEntry } from "../../domain/index.js";
import { businessDateOf } from "./business-date.js";

export interface ExpireCreditsResult {
  readonly expiredEntries: number;
}

/**
 * Writes one EXPIRE entry per expired purchase remainder. Idempotent through the partial unique
 * index on (organizationId, source.sourceId) for EXPIRE rows; a second run catches the duplicate
 * and changes nothing. There is no scheduler in this card: a job (3.6) calls this per organization.
 */
export class ExpireCreditsUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(): Promise<ExpireCreditsResult> {
    const today = businessDateOf(this.deps.clock.now());
    const purchases = await this.deps.credit.listExpiringPurchases(today);
    const spentByAccount = await this.spentByAccount(purchases);
    let expiredEntries = 0;

    for (const purchase of purchases) {
      const customerAccountId = purchase.customerAccountId as CustomerAccountId;
      const spent = spentByAccount.get(customerAccountId)?.get(purchase.creditEntryId) ?? 0;
      const unused = purchase.credits - spent;
      if (unused <= 0) continue;
      if (await this.expirePurchase(purchase, unused, today)) expiredEntries += 1;
    }
    return { expiredEntries };
  }

  private async spentByAccount(
    purchases: readonly CreditEntry[],
  ): Promise<ReadonlyMap<CustomerAccountId, ReadonlyMap<string, number>>> {
    const byAccount = new Map<CustomerAccountId, string[]>();
    for (const purchase of purchases) {
      const customerAccountId = purchase.customerAccountId as CustomerAccountId;
      const ids = byAccount.get(customerAccountId) ?? [];
      ids.push(purchase.creditEntryId);
      byAccount.set(customerAccountId, ids);
    }
    const result = new Map<CustomerAccountId, ReadonlyMap<string, number>>();
    for (const [customerAccountId, ids] of byAccount) {
      result.set(
        customerAccountId,
        await this.deps.credit.sumSpendsByPurchase(customerAccountId, ids),
      );
    }
    return result;
  }

  /** False when the balance no longer covers the remainder (already spent) or a job won the race. */
  private async expirePurchase(
    purchase: CreditEntry,
    unused: number,
    today: string,
  ): Promise<boolean> {
    try {
      return await this.deps.unitOfWork.run(async () => {
        const balance = await this.deps.credit.applyDelta({
          customerAccountId: purchase.customerAccountId as CustomerAccountId,
          delta: -unused,
        });
        if (!balance) return false;

        const entry = this.buildEntry(purchase, unused, today);
        await this.deps.credit.insertEntry(entry);
        await this.deps.events.publish(
          CREDIT_EVENT_TYPE.CREDIT_ENTRY_CREATED,
          {
            creditEntryId: entry.creditEntryId,
            customerAccountId: entry.customerAccountId,
            type: CREDIT_ENTRY_TYPE.EXPIRE,
            credits: entry.credits,
            source: entry.source,
            occurredAt: entry.occurredAt,
          },
          { orderingKey: `creditAccount:${entry.customerAccountId}` },
        );
        return true;
      });
    } catch (error) {
      if (error instanceof CreditEntryAlreadyExistsError) return false;
      throw error;
    }
  }

  private buildEntry(purchase: CreditEntry, unused: number, today: string) {
    const now = this.deps.clock.now();
    return {
      creditEntryId: newId(),
      customerAccountId: purchase.customerAccountId as CustomerAccountId,
      type: CREDIT_ENTRY_TYPE.EXPIRE,
      credits: -unused,
      expiresOn: null,
      source: { sourceType: CREDIT_SOURCE_TYPE.EXPIRY_JOB, sourceId: purchase.creditEntryId },
      fromPurchaseEntryId: purchase.creditEntryId,
      reason: null,
      createdByUserId: null,
      occurredAt: now.toISOString(),
      businessDate: today,
      createdAt: now.toISOString(),
    };
  }
}
