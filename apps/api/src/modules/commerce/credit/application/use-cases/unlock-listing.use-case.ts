import { newId, type CustomerAccountId, type ListingId } from "@banijjik/ids";
import {
  CREDIT_ENTRY_TYPE,
  CREDIT_EVENT_TYPE,
  CREDIT_SOURCE_TYPE,
  CREDIT_RULE_KEY,
} from "@banijjik/contracts/credit";
import { LISTING_STATUS } from "@banijjik/contracts/directory";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import {
  CannotUnlockOwnListingError,
  CreditsInsufficientError,
  ListingNotApprovedError,
  ListingNotFoundError,
  ListingUnlockAlreadyExistsError,
  UnlocksPerDayExceededError,
  allocateSpend,
  type SpendAllocation,
} from "../../domain/index.js";
import { getRequestContext } from "../../../../../kernel/context/index.js";
import type { OrganizationId } from "@banijjik/ids";
import { businessDateOf, businessDayBounds } from "./business-date.js";

export interface UnlockListingInput {
  readonly listingNumber: string;
  readonly customerAccountId: CustomerAccountId;
}

export interface UnlockListingOutput {
  readonly listingUnlockId: string;
  readonly listingId: string;
  readonly unlockedAt: string;
  readonly creditsSpent: number;
  readonly remainingBalance: number;
}

const DEFAULT_UNLOCK_COST = 1;
const DEFAULT_UNLOCKS_PER_DAY = 20;

export class UnlockListingUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(input: UnlockListingInput): Promise<UnlockListingOutput> {
    const listing = await this.deps.listings.findByListingNumber(input.listingNumber);
    if (!listing) throw new ListingNotFoundError();
    if (listing.status !== LISTING_STATUS.APPROVED) throw new ListingNotApprovedError();
    if (listing.ownerCustomerAccountId === input.customerAccountId) {
      throw new CannotUnlockOwnListingError();
    }

    const existing = await this.deps.unlocks.findExisting(
      input.customerAccountId,
      listing.listingId,
    );
    if (existing) return this.idempotentResponse(existing, input.customerAccountId);

    const organizationId = this.organizationId();
    const unlockCost = await this.amountSetting(
      organizationId,
      CREDIT_RULE_KEY.UNLOCK_COST,
      DEFAULT_UNLOCK_COST,
    );
    const dailyLimit = await this.amountSetting(
      organizationId,
      CREDIT_RULE_KEY.UNLOCKS_PER_DAY,
      DEFAULT_UNLOCKS_PER_DAY,
    );
    const now = this.deps.clock.now();
    const timeZone = await this.deps.timeZone.read(organizationId);
    const today = businessDateOf(now, timeZone);

    try {
      return await this.performUnlock({
        customerAccountId: input.customerAccountId,
        listingId: listing.listingId,
        unlockCost,
        businessDate: today,
        businessDay: businessDayBounds(today, timeZone),
        dailyLimit,
        now,
      });
    } catch (error) {
      // The unique key is the final guard under concurrency: the loser reads the winner's unlock
      // after its own transaction was rolled back.
      if (!(error instanceof ListingUnlockAlreadyExistsError)) throw error;
      const winner = await this.deps.unlocks.findExisting(
        input.customerAccountId,
        listing.listingId,
      );
      if (!winner) throw error;
      return this.idempotentResponse(winner, input.customerAccountId);
    }
  }

  private organizationId(): OrganizationId {
    const { organizationId } = getRequestContext();
    if (!organizationId) throw new Error("Organization context required for an unlock");
    return organizationId as OrganizationId;
  }

  private async amountSetting(
    organizationId: OrganizationId,
    key: string,
    fallback: number,
  ): Promise<number> {
    const resolved = await this.deps.resolveSettings(organizationId, [key]);
    const value = resolved.get(key)?.value;
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private async assertWithinDailyLimit(
    customerAccountId: CustomerAccountId,
    dailyLimit: number,
    businessDay: { readonly from: Date; readonly to: Date },
  ): Promise<void> {
    const todayCount = await this.deps.unlocks.countByCustomerToday(customerAccountId, businessDay);
    if (todayCount >= dailyLimit) throw new UnlocksPerDayExceededError();
  }

  private async performUnlock(input: {
    readonly customerAccountId: CustomerAccountId;
    readonly listingId: ListingId;
    readonly unlockCost: number;
    readonly businessDate: string;
    readonly businessDay: { readonly from: Date; readonly to: Date };
    readonly dailyLimit: number;
    readonly now: Date;
  }): Promise<UnlockListingOutput> {
    return this.deps.unitOfWork.run(async () => {
      // This account write serializes different listings and expiry across API instances.
      // Mongo retries a conflicting transaction with a fresh snapshot.
      await this.deps.credit.applyDelta({ customerAccountId: input.customerAccountId, delta: 0 });
      const existing = await this.deps.unlocks.findExisting(
        input.customerAccountId,
        input.listingId,
      );
      if (existing) return this.idempotentResponse(existing, input.customerAccountId);
      await this.assertWithinDailyLimit(
        input.customerAccountId,
        input.dailyLimit,
        input.businessDay,
      );
      const updatedBalance = await this.deps.credit.applyDelta({
        customerAccountId: input.customerAccountId,
        delta: -input.unlockCost,
      });
      if (!updatedBalance) {
        const balance = await this.deps.credit.getBalance(input.customerAccountId);
        throw new CreditsInsufficientError(balance?.balance ?? 0, input.unlockCost);
      }

      const entries = await this.createSpendEntries(input);
      const firstEntry = entries[0];
      if (!firstEntry) throw new Error("A paid unlock requires a spend entry");
      const unlock = {
        listingUnlockId: newId(),
        customerAccountId: input.customerAccountId,
        listingId: input.listingId,
        creditEntryId: firstEntry.creditEntryId,
        unlockedAt: input.now.toISOString(),
        createdAt: input.now.toISOString(),
      };
      await this.deps.unlocks.insert(unlock);
      await this.publishEvents(entries, unlock, input);

      return {
        listingUnlockId: unlock.listingUnlockId,
        listingId: unlock.listingId,
        unlockedAt: unlock.unlockedAt,
        creditsSpent: input.unlockCost,
        remainingBalance: updatedBalance.balance,
      };
    });
  }

  private async createSpendEntries(input: {
    readonly customerAccountId: CustomerAccountId;
    readonly listingId: ListingId;
    readonly unlockCost: number;
    readonly businessDate: string;
    readonly now: Date;
  }): Promise<readonly SpentEntry[]> {
    const allocations = await this.allocationsForSpend(
      input.customerAccountId,
      input.unlockCost,
      input.businessDate,
    );
    const now = input.now;
    const entries: SpentEntry[] = [];
    for (const allocation of allocations) {
      const entry = {
        creditEntryId: newId(),
        customerAccountId: input.customerAccountId,
        type: CREDIT_ENTRY_TYPE.SPEND,
        credits: -allocation.credits,
        expiresOn: null,
        source: { sourceType: CREDIT_SOURCE_TYPE.UNLOCK, sourceId: input.listingId },
        fromPurchaseEntryId: allocation.purchaseEntryId,
        reason: null,
        createdByUserId: null,
        occurredAt: now.toISOString(),
        businessDate: input.businessDate,
        createdAt: now.toISOString(),
      };
      await this.deps.credit.insertEntry(entry);
      entries.push(entry);
    }
    return entries;
  }

  private async allocationsForSpend(
    customerAccountId: CustomerAccountId,
    cost: number,
    asOf: string,
  ): Promise<readonly SpendAllocation[]> {
    const purchases = await this.deps.credit.listPurchases(customerAccountId);
    const spent = await this.deps.credit.sumSpendsByPurchase(
      customerAccountId,
      purchases.map((purchase) => purchase.creditEntryId),
    );
    return allocateSpend({
      cost,
      asOf,
      purchases: purchases.map((purchase) => ({
        purchaseEntryId: purchase.creditEntryId,
        credits: purchase.credits,
        spent: spent.get(purchase.creditEntryId) ?? 0,
        occurredAt: purchase.occurredAt,
        expiresOn: purchase.expiresOn,
      })),
    });
  }

  private async idempotentResponse(
    existingUnlock: { listingUnlockId: string; listingId: string; unlockedAt: string },
    customerAccountId: CustomerAccountId,
  ): Promise<UnlockListingOutput> {
    const balance = await this.deps.credit.getBalance(customerAccountId);
    return {
      listingUnlockId: existingUnlock.listingUnlockId,
      listingId: existingUnlock.listingId,
      unlockedAt: existingUnlock.unlockedAt,
      creditsSpent: 0,
      remainingBalance: balance?.balance ?? 0,
    };
  }

  private async publishEvents(
    entries: readonly SpentEntry[],
    unlock: {
      listingUnlockId: string;
      customerAccountId: CustomerAccountId;
      listingId: ListingId;
      creditEntryId: string;
      unlockedAt: string;
    },
    input: { readonly customerAccountId: CustomerAccountId; readonly listingId: ListingId },
  ): Promise<void> {
    for (const entry of entries) {
      await this.deps.events.publish(
        CREDIT_EVENT_TYPE.CREDIT_ENTRY_CREATED,
        {
          creditEntryId: entry.creditEntryId,
          customerAccountId: input.customerAccountId,
          type: CREDIT_ENTRY_TYPE.SPEND,
          credits: entry.credits,
          source: entry.source,
          occurredAt: entry.occurredAt,
        },
        { orderingKey: `creditAccount:${input.customerAccountId}` },
      );
    }

    await this.deps.events.publish(
      CREDIT_EVENT_TYPE.UNLOCK_CREATED,
      {
        listingUnlockId: unlock.listingUnlockId,
        customerAccountId: input.customerAccountId,
        listingId: input.listingId,
        creditEntryId: unlock.creditEntryId,
        unlockedAt: unlock.unlockedAt,
      },
      { orderingKey: `listing:${input.listingId}` },
    );
  }
}

interface SpentEntry {
  readonly creditEntryId: string;
  readonly customerAccountId: CustomerAccountId;
  readonly type: "SPEND";
  readonly credits: number;
  readonly expiresOn: null;
  readonly source: { sourceType: "UNLOCK"; sourceId: string };
  readonly fromPurchaseEntryId: string | null;
  readonly reason: null;
  readonly createdByUserId: null;
  readonly occurredAt: string;
  readonly businessDate: string;
  readonly createdAt: string;
}
