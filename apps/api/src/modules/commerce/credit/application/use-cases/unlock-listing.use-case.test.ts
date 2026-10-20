import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import type { CreditRepository } from "../ports/credit-repository.js";
import type { ListingUnlockRepository } from "../ports/listing-unlock-repository.js";
import { UnlockListingUseCase } from "./unlock-listing.use-case.js";

describe("UnlockListingUseCase - concurrency", () => {
  let creditRepo: CreditRepository;
  let unlockRepo: ListingUnlockRepository;
  let useCase: UnlockListingUseCase;
  let organizationId: string;
  let customerAccountId: string;
  let listingIds: string[];

  beforeEach(() => {
    creditRepo = {
      insertEntry: vi.fn(),
      listEntries: vi.fn(),
      getBalance: vi.fn(),
      insertBalance: vi.fn(),
      updateBalance: vi.fn(),
    } as unknown as CreditRepository;

    unlockRepo = {
      insert: vi.fn(),
      findExisting: vi.fn(),
      listByCustomer: vi.fn(),
      countByListing: vi.fn(),
      countByCustomerToday: vi.fn(),
    } as unknown as ListingUnlockRepository;

    const deps: CreditDependencies = {
      credit: creditRepo,
      packs: {} as unknown as ReturnType<typeof vi.fn>,
      unlocks: unlockRepo,
      unitOfWork: { withTransaction: vi.fn((fn) => fn()) } as unknown as ReturnType<typeof vi.fn>,
      events: { publish: vi.fn() } as unknown as ReturnType<typeof vi.fn>,
      audit: {} as unknown as ReturnType<typeof vi.fn>,
      clock: { now: () => new Date() } as unknown as ReturnType<typeof vi.fn>,
    };

    useCase = new UnlockListingUseCase(deps);
    organizationId = "org-1";
    customerAccountId = "customer-1";
    listingIds = ["listing-1", "listing-2", "listing-3", "listing-4", "listing-5"];
  });

  it("should allow exactly 3 parallel unlocks with a balance of 3", async () => {
    const initialBalance = 3;
    const unlockCost = 1;

    vi.spyOn(creditRepo, "getBalance").mockResolvedValue({
      customerAccountId,
      balance: initialBalance,
      version: 1,
      updatedAt: new Date().toISOString(),
    });

    vi.spyOn(unlockRepo, "findExisting").mockResolvedValue(null);
    vi.spyOn(unlockRepo, "countByCustomerToday").mockResolvedValue(0);

    let balanceUpdateCalls = 0;
    vi.spyOn(creditRepo, "updateBalance").mockImplementation(async (input) => {
      balanceUpdateCalls++;
      if (balanceUpdateCalls > 3) {
        throw new Error("Balance version mismatch");
      }
      return {
        customerAccountId: input.customerAccountId,
        balance: initialBalance - balanceUpdateCalls,
        version: 1 + balanceUpdateCalls,
        updatedAt: new Date().toISOString(),
      };
    });

    vi.spyOn(unlockRepo, "insert").mockResolvedValue();

    const results = await Promise.allSettled(
      listingIds.map((listingId) =>
        useCase.execute({
          organizationId,
          customerAccountId,
          listingId,
          listingNumber: "L-1",
          ownerCustomerAccountId: "owner-1",
          unlockCost,
          unlockLimitPerDay: 20,
          idempotencyKey: `key-${listingId}`,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    expect(succeeded.length).toBe(3);
    expect(failed.length).toBe(2);
    expect(balanceUpdateCalls).toBe(3);
  });
});
