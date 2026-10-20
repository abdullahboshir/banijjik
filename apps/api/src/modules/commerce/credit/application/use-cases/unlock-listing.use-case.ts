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
  readonly organizationId: string;
  readonly customerAccountId: string;
  readonly listingId: string;
  readonly listingNumber: string;
  readonly ownerCustomerAccountId: string;
  readonly unlockCost: number;
  readonly unlockLimitPerDay: number;
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
    this.validateNotOwnListing(input);

    const existingUnlock = await this.deps.unlocks.findExisting(
      input.customerAccountId,
      input.listingId,
    );
    if (existingUnlock) {
      return this.idempotentResponse(existingUnlock, input.customerAccountId);
    }

    await this.validateDailyLimit(input);

    return this.performUnlock(input);
  }

  private validateNotOwnListing(input: UnlockListingInput): void {
    if (input.customerAccountId === input.ownerCustomerAccountId) {
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

  private async validateDailyLimit(input: UnlockListingInput): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    const todayCount = await this.deps.unlocks.countByCustomerToday(input.customerAccountId, today);
    if (todayCount >= input.unlockLimitPerDay) {
      throw new UnlocksPerDayExceededError();
    }
  }

  private async performUnlock(input: UnlockListingInput): Promise<UnlockListingOutput> {
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

  private createCreditEntry(input: UnlockListingInput): CreditEntryEntity {
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

  private createUnlock(input: UnlockListingInput, creditEntryId: string): ListingUnlockEntity {
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
    input: UnlockListingInput,
  ): Promise<void> {
    await this.deps.events.publish({
      eventType: "CREDIT_ENTRY_CREATED",
      payload: {
        creditEntryId: creditEntry.creditEntryId,
        customerAccountId: input.customerAccountId,
        type: CREDIT_ENTRY_TYPE.SPEND,
        credits: -input.unlockCost,
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

  private getBalance(organizationId: string, customerAccountId: string): number {
    const balance = this.deps.credit.getBalance(organizationId, customerAccountId);
    return balance?.balance ?? 0;
  }
}
