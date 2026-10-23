import {
  CREDIT_ENTRY_TYPE,
  CREDIT_EVENT_TYPE,
  CREDIT_SOURCE_TYPE,
} from "@banijjik/contracts/credit";
import { newId, asId, type CustomerAccountId, type OrganizationId } from "@banijjik/ids";
import { findRequestContext } from "../../../../../kernel/context/index.js";
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

  async execute(input?: {
    readonly organizationId?: OrganizationId;
  }): Promise<ExpireCreditsResult> {
    const ctx = findRequestContext();
    const organizationId =
      input?.organizationId ??
      (ctx?.organizationId ? asId<OrganizationId>(ctx.organizationId) : newId<OrganizationId>());
    const timeZone = await this.deps.timeZone.read(organizationId);
    const today = businessDateOf(this.deps.clock.now(), timeZone);
    const purchases = await this.deps.credit.listExpiringPurchases(today);
    let expiredEntries = 0;

    for (const purchase of purchases) {
      if (await this.expirePurchase(purchase, today)) expiredEntries += 1;
    }
    return { expiredEntries };
  }

  /** False when the balance no longer covers the remainder (already spent) or a job won the race. */
  private async expirePurchase(purchase: CreditEntry, today: string): Promise<boolean> {
    try {
      return await this.deps.unitOfWork.run(async () => {
        const customerAccountId = purchase.customerAccountId as CustomerAccountId;
        // Serialize expiry with unlocks before reading attribution, including transaction retries.
        const locked = await this.deps.credit.applyDelta({ customerAccountId, delta: 0 });
        if (!locked) return false;
        const spent = await this.deps.credit.sumSpendsByPurchase(customerAccountId, [
          purchase.creditEntryId,
        ]);
        const unused = purchase.credits - (spent.get(purchase.creditEntryId) ?? 0);
        if (unused <= 0) return false;
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
