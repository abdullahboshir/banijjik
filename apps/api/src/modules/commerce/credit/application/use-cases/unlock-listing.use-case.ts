import { newId } from "@banijjik/ids";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import {
  CreditsInsufficientError,
  CannotUnlockOwnListingError,
  ListingNotApprovedError,
  UnlocksPerDayExceededError,
} from "../../domain/errors.js";
import { CREDIT_ENTRY_TYPE, CREDIT_SOURCE_TYPE } from "@banijjik/contracts/credit";
import type { CustomerAccountId, ListingId } from "@banijjik/ids";

export interface UnlockListingInput {
  readonly listingNumber: string;
  readonly customerAccountId: CustomerAccountId;
  readonly idempotencyKey: string;
}

export interface UnlockListingOutput {
  readonly listingUnlockId: string;
  readonly listingId: string;
  readonly unlockedAt: string;
  readonly creditsSpent: number;
  readonly remainingBalance: number;
}

export class UnlockListingUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(input: UnlockListingInput): Promise<UnlockListingOutput> {
    const listing = await this.deps.listings.findByListingNumber(input.listingNumber);
    if (!listing) {
      throw new Error("Listing not found");
    }

    this.validateListingApproved(listing.status);
    this.validateNotOwnListing(input.customerAccountId, listing.ownerCustomerAccountId);

    const existingUnlock = await this.deps.unlocks.findExisting(
      input.customerAccountId,
      listing.listingId,
    );
    if (existingUnlock) {
      return this.idempotentResponse(existingUnlock, input.customerAccountId);
    }

    const unlockCost = 1;
    const dailyLimit = 20;
    await this.validateDailyLimit(input.customerAccountId, dailyLimit);

    return this.performUnlock({
      customerAccountId: input.customerAccountId,
      listingId: listing.listingId,
      unlockCost,
    });
  }

  private validateListingApproved(status: string): void {
    if (status !== "APPROVED") {
      throw new ListingNotApprovedError();
    }
  }

  private validateNotOwnListing(
    customerAccountId: CustomerAccountId,
    ownerCustomerAccountId: CustomerAccountId,
  ): void {
    if (customerAccountId === ownerCustomerAccountId) {
      throw new CannotUnlockOwnListingError();
    }
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

  private async validateDailyLimit(
    customerAccountId: CustomerAccountId,
    dailyLimit: number,
  ): Promise<void> {
    const today = new Date().toISOString().split("T")[0] ?? "";
    const todayCount = await this.deps.unlocks.countByCustomerToday(customerAccountId, today);
    if (todayCount >= dailyLimit) {
      throw new UnlocksPerDayExceededError();
    }
  }

  private async performUnlock(input: {
    readonly customerAccountId: CustomerAccountId;
    readonly listingId: ListingId;
    readonly unlockCost: number;
  }): Promise<UnlockListingOutput> {
    return this.deps.unitOfWork.run(async () => {
      const balance = await this.ensureBalance(input.customerAccountId);
      this.checkSufficientBalance(balance, input.unlockCost);

      const updatedBalance = await this.deps.credit.updateBalance({
        customerAccountId: input.customerAccountId,
        expectedVersion: balance.version,
        delta: -input.unlockCost,
      });

      const creditEntry = this.createCreditEntry(input);
      await this.deps.credit.insertEntry(creditEntry);

      const unlock = this.createUnlock(input, creditEntry.creditEntryId);
      await this.deps.unlocks.insert(unlock);

      await this.publishEvents(creditEntry, unlock, input);

      return {
        listingUnlockId: unlock.listingUnlockId,
        listingId: unlock.listingId,
        unlockedAt: unlock.unlockedAt,
        creditsSpent: input.unlockCost,
        remainingBalance: updatedBalance.balance,
      };
    });
  }

  private async ensureBalance(customerAccountId: CustomerAccountId) {
    const balance = await this.deps.credit.getBalance(customerAccountId);
    if (!balance) {
      await this.deps.credit.insertBalance({
        customerAccountId,
        balance: 0,
        version: 1,
        updatedAt: this.deps.clock.now().toISOString(),
      });
      throw new CreditsInsufficientError(0, 0);
    }
    return balance;
  }

  private checkSufficientBalance(
    balance: { balance: number; version: number },
    unlockCost: number,
  ): void {
    if (balance.balance < unlockCost) {
      throw new CreditsInsufficientError(balance.balance, unlockCost);
    }
  }

  private createCreditEntry(input: {
    readonly customerAccountId: CustomerAccountId;
    readonly listingId: ListingId;
    readonly unlockCost: number;
  }): {
    creditEntryId: string;
    customerAccountId: CustomerAccountId;
    type: "PURCHASE" | "SPEND" | "REFUND" | "EXPIRE" | "ADJUST";
    credits: number;
    expiresOn: string | null;
    source: { sourceType: "PAYMENT" | "UNLOCK" | "ADJUSTMENT" | "EXPIRY_JOB"; sourceId: string };
    fromPurchaseEntryId: string | null;
    reason: string | null;
    createdByUserId: string | null;
    occurredAt: string;
    businessDate: string;
    createdAt: string;
  } {
    const today = new Date().toISOString().split("T")[0] ?? "";
    const creditEntryId = newId();
    const now = this.deps.clock.now();
    return {
      creditEntryId,
      customerAccountId: input.customerAccountId,
      type: CREDIT_ENTRY_TYPE.SPEND,
      credits: -input.unlockCost,
      expiresOn: null,
      source: { sourceType: CREDIT_SOURCE_TYPE.UNLOCK, sourceId: input.listingId },
      fromPurchaseEntryId: null,
      reason: null,
      createdByUserId: null,
      occurredAt: now.toISOString(),
      businessDate: today,
      createdAt: now.toISOString(),
    };
  }

  private createUnlock(
    input: {
      readonly customerAccountId: CustomerAccountId;
      readonly listingId: ListingId;
      readonly unlockCost: number;
    },
    creditEntryId: string,
  ): {
    listingUnlockId: string;
    customerAccountId: CustomerAccountId;
    listingId: ListingId;
    creditEntryId: string;
    unlockedAt: string;
    createdAt: string;
  } {
    const listingUnlockId = newId();
    const now = this.deps.clock.now();
    return {
      listingUnlockId,
      customerAccountId: input.customerAccountId,
      listingId: input.listingId,
      creditEntryId,
      unlockedAt: now.toISOString(),
      createdAt: now.toISOString(),
    };
  }

  private async publishEvents(
    creditEntry: {
      creditEntryId: string;
      credits: number;
      source: { sourceType: string; sourceId: string };
      occurredAt: string;
    },
    unlock: { listingUnlockId: string; unlockedAt: string },
    input: { readonly customerAccountId: CustomerAccountId; readonly listingId: ListingId },
  ): Promise<void> {
    await this.deps.events.publish(
      "CREDIT_ENTRY_CREATED",
      {
        creditEntryId: creditEntry.creditEntryId,
        customerAccountId: input.customerAccountId,
        type: CREDIT_ENTRY_TYPE.SPEND,
        credits: creditEntry.credits,
        source: creditEntry.source,
        occurredAt: creditEntry.occurredAt,
      },
      { orderingKey: `creditAccount:${input.customerAccountId}` },
    );

    await this.deps.events.publish(
      "UNLOCK_CREATED",
      {
        listingUnlockId: unlock.listingUnlockId,
        customerAccountId: input.customerAccountId,
        listingId: input.listingId,
        creditEntryId: creditEntry.creditEntryId,
        unlockedAt: unlock.unlockedAt,
      },
      { orderingKey: `listing:${input.listingId}` },
    );
  }
}
