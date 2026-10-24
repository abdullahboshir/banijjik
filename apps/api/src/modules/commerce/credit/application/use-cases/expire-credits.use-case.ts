import {
  CREDIT_ENTRY_TYPE,
  CREDIT_EVENT_TYPE,
  CREDIT_SOURCE_TYPE,
} from "@banijjik/contracts/credit";
import { newId, type CustomerAccountId, type OrganizationId } from "@banijjik/ids";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { CreditEntryAlreadyExistsError, type CreditEntry } from "../../domain/index.js";
import { getLogger } from "../../../../../kernel/logger/index.js";
import { businessDateOf } from "./business-date.js";

export const EXPIRY_PAGE_SIZE = 100;

export type ExpireCreditsDependencies = Pick<
  CreditDependencies,
  "credit" | "unitOfWork" | "events" | "clock" | "timeZone"
>;

export interface ExpireCreditsResult {
  readonly expiredEntries: number;
  readonly failedEntries: number;
}

/**
 * Writes one EXPIRE entry per expired purchase remainder. Idempotent through the partial unique
 * index on (organizationId, source.sourceId) for EXPIRE rows; a second run catches the duplicate
 * and changes nothing. The hourly job `credit.expireCredits` (card 3.28) calls this per organization.
 * Purchases are read one keyset page at a time, and one failing row is logged and skipped.
 */
export class ExpireCreditsUseCase {
  constructor(private readonly deps: ExpireCreditsDependencies) {}

  async execute(input: { readonly organizationId: OrganizationId }): Promise<ExpireCreditsResult> {
    const timeZone = await this.deps.timeZone.read(input.organizationId);
    const today = businessDateOf(this.deps.clock.now(), timeZone);
    let expiredEntries = 0;
    let failedEntries = 0;
    let after: CreditEntry | undefined;

    for (;;) {
      const page = await this.deps.credit.listExpiringPurchasesPage({
        today,
        after,
        limit: EXPIRY_PAGE_SIZE,
      });
      for (const purchase of page) {
        const outcome = await this.expirePurchaseSafely(input.organizationId, purchase, today);
        if (outcome === "expired") expiredEntries += 1;
        if (outcome === "failed") failedEntries += 1;
      }
      if (page.length < EXPIRY_PAGE_SIZE) return { expiredEntries, failedEntries };
      after = page[page.length - 1];
    }
  }

  /** One bad row must not stop the run: log it with ids only and carry on. */
  private async expirePurchaseSafely(
    organizationId: OrganizationId,
    purchase: CreditEntry,
    today: string,
  ): Promise<"expired" | "skipped" | "failed"> {
    try {
      return (await this.expirePurchase(purchase, today)) ? "expired" : "skipped";
    } catch (error) {
      getLogger().error(
        {
          event: "credit.expire_purchase_failed",
          organizationId,
          creditEntryId: purchase.creditEntryId,
          err: error,
        },
        "credit expiry failed for one purchase",
      );
      return "failed";
    }
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
