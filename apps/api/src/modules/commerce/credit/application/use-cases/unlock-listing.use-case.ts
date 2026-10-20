import { newId } from "@banijjik/ids";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import {
  CreditsInsufficientError,
  CannotUnlockOwnListingError,
  UnlocksPerDayExceededError,
} from "../../domain/errors.js";
import { CreditEntryEntity } from "../../domain/credit-entry.entity.js";
import { CreditBalanceEntity } from "../../domain/credit-balance.entity.js";
import { ListingUnlockEntity } from "../../domain/listing-unlock.entity.js";
import { CREDIT_ENTRY_TYPE, CREDIT_SOURCE_TYPE } from "@banijjik/contracts/credit";

export interface UnlockListingInput {
  readonly listingId: string;
  readonly customerAccountId: string;
  readonly ownerCustomerAccountId: string;
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
    this.validateNotOwnListing(input.customerAccountId, input.ownerCustomerAccountId);

    const existingUnlock = await this.deps.unlocks.findExisting(
      input.customerAccountId,
      input.listingId,
    );
    if (existingUnlock) {
      return this.idempotentResponse(existingUnlock, input.customerAccountId);
    }

    const unlockCost = 1;
    const dailyLimit = 20;
    await this.validateDailyLimit(input.customerAccountId, dailyLimit);

    return this.performUnlock({
      customerAccountId: input.customerAccountId,
      listingId: input.listingId,
      unlockCost,
    });
  }

  private validateNotOwnListing(customerAccountId: string, ownerCustomerAccountId: string): void {
    if (customerAccountId === ownerCustomerAccountId) {
      throw new CannotUnlockOwnListingError();
    }
  }

  private idempotentResponse(
    existingUnlock: ListingUnlockEntity,
    customerAccountId: string,
  ): UnlockListingOutput {
    return {
      listingUnlockId: existingUnlock.listingUnlockId,
      listingId: existingUnlock.listingId,
      unlockedAt: existingUnlock.unlockedAt,
      creditsSpent: 0,
      remainingBalance: this.getBalance(customerAccountId),
    };
  }

  private async validateDailyLimit(customerAccountId: string, dailyLimit: number): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    const todayCount = await this.deps.unlocks.countByCustomerToday(customerAccountId, today);
    if (todayCount >= dailyLimit) {
      throw new UnlocksPerDayExceededError();
    }
  }

  private async performUnlock(input: {
    readonly customerAccountId: string;
    readonly listingId: string;
    readonly unlockCost: number;
  }): Promise<UnlockListingOutput> {
    return this.deps.unitOfWork.withTransaction(async () => {
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

  private async ensureBalance(customerAccountId: string) {
    const balance = await this.deps.credit.getBalance(customerAccountId);
    if (!balance) {
      await this.deps.credit.insertBalance(CreditBalanceEntity.create(customerAccountId));
      throw new CreditsInsufficientError(0, 0);
    }
    return balance;
  }

  private checkSufficientBalance(balance: CreditBalanceEntity, unlockCost: number): void {
    if (balance.balance < unlockCost) {
      throw new CreditsInsufficientError(balance.balance, unlockCost);
    }
  }

  private createCreditEntry(input: {
    readonly customerAccountId: string;
    readonly listingId: string;
    readonly unlockCost: number;
  }): CreditEntryEntity {
    const today = new Date().toISOString().split("T")[0];
    const creditEntryId = newId();
    return CreditEntryEntity.create({
      creditEntryId,
      customerAccountId: input.customerAccountId,
      type: CREDIT_ENTRY_TYPE.SPEND,
      credits: -input.unlockCost,
      expiresOn: null,
      source: { sourceType: CREDIT_SOURCE_TYPE.UNLOCK, sourceId: input.listingId },
      fromPurchaseEntryId: null,
      reason: null,
      createdByUserId: null,
      occurredAt: this.deps.clock.now(),
      businessDate: today,
    });
  }

  private createUnlock(
    input: {
      readonly customerAccountId: string;
      readonly listingId: string;
      readonly unlockCost: number;
    },
    creditEntryId: string,
  ): ListingUnlockEntity {
    const listingUnlockId = newId();
    return ListingUnlockEntity.create({
      listingUnlockId,
      customerAccountId: input.customerAccountId,
      listingId: input.listingId,
      creditEntryId,
      unlockedAt: this.deps.clock.now(),
    });
  }

  private async publishEvents(
    creditEntry: CreditEntryEntity,
    unlock: ListingUnlockEntity,
    input: { readonly customerAccountId: string; readonly listingId: string },
  ): Promise<void> {
    await this.deps.events.publish({
      eventType: "CREDIT_ENTRY_CREATED",
      payload: {
        creditEntryId: creditEntry.creditEntryId,
        customerAccountId: input.customerAccountId,
        type: CREDIT_ENTRY_TYPE.SPEND,
        credits: creditEntry.credits,
        source: creditEntry.source,
        occurredAt: creditEntry.occurredAt.toISOString(),
      },
      orderingKey: `creditAccount:${input.customerAccountId}`,
    });

    await this.deps.events.publish({
      eventType: "UNLOCK_CREATED",
      payload: {
        listingUnlockId: unlock.listingUnlockId,
        customerAccountId: input.customerAccountId,
        listingId: input.listingId,
        creditEntryId: creditEntry.creditEntryId,
        unlockedAt: unlock.unlockedAt.toISOString(),
      },
      orderingKey: `listing:${input.listingId}`,
    });
  }

  private getBalance(customerAccountId: string): number {
    const balance = this.deps.credit.getBalance(customerAccountId);
    return balance?.balance ?? 0;
  }
}
