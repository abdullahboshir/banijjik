import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import type { CreditRepository } from "../ports/credit-repository.js";
import type { ListingUnlockRepository } from "../ports/listing-unlock-repository.js";
import type { ListingRepository } from "../../../directory/index.js";
import { UnlockListingUseCase } from "./unlock-listing.use-case.js";
import { asId, type CustomerAccountId } from "@banijjik/ids";

describe("UnlockListingUseCase - concurrency", () => {
  let creditRepo: CreditRepository;
  let unlockRepo: ListingUnlockRepository;
  let listingRepo: ListingRepository;
  let useCase: UnlockListingUseCase;
  let customerAccountId: CustomerAccountId;
  let listingIds: string[];

  beforeEach(() => {
    creditRepo = {
      insertEntry: vi.fn(),
      listEntries: vi.fn(),
      getBalance: vi.fn(),
      insertBalance: vi.fn(),
      updateBalance: vi.fn(),
      findPurchaseEntry: vi.fn(),
    } as unknown as CreditRepository;

    unlockRepo = {
      insert: vi.fn(),
      findExisting: vi.fn(),
      listByCustomer: vi.fn(),
      countByListing: vi.fn(),
      countByCustomerToday: vi.fn(),
      findByCustomerAndListing: vi.fn(),
    } as unknown as ListingUnlockRepository;

    listingRepo = {
      insert: vi.fn(),
      save: vi.fn(),
      findById: vi.fn(),
      findByListingNumber: vi.fn(),
      findActiveByOwner: vi.fn(),
      searchApproved: vi.fn(),
      listQueue: vi.fn(),
      explainSearch: vi.fn(),
    } as unknown as ListingRepository;

    const deps: CreditDependencies = {
      credit: creditRepo,
      packs: {
        insert: vi.fn(),
        save: vi.fn(),
        findById: vi.fn(),
        listActive: vi.fn(),
      } as unknown as CreditDependencies["packs"],
      unlocks: unlockRepo,
      listings: listingRepo,
      unitOfWork: { run: vi.fn((fn) => fn()) } as unknown as CreditDependencies["unitOfWork"],
      events: { publish: vi.fn() } as unknown as CreditDependencies["events"],
      audit: { record: vi.fn() } as unknown as CreditDependencies["audit"],
      clock: { now: () => new Date() } as unknown as CreditDependencies["clock"],
      directorySettings: {
        oneListingPerAccount: vi.fn(() => Promise.resolve(false)),
        reviewEdits: vi.fn(() => Promise.resolve(false)),
        photoPolicy: vi.fn(() => Promise.resolve("NONE")),
      } as unknown as CreditDependencies["directorySettings"],
    };

    useCase = new UnlockListingUseCase(deps);
    customerAccountId = asId<CustomerAccountId>("customer-1");
    listingIds = ["listing-1", "listing-2", "listing-3", "listing-4", "listing-5"];

    vi.spyOn(listingRepo, "findByListingNumber").mockResolvedValue({
      listingId: "listing-1",
      listingNumber: "L-1",
      ownerCustomerAccountId: asId<CustomerAccountId>("owner-1"),
      status: "APPROVED",
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown);

    vi.spyOn(unlockRepo, "findExisting").mockResolvedValue(null);
    vi.spyOn(unlockRepo, "countByCustomerToday").mockResolvedValue(0);
  });

  it("should allow exactly 3 parallel unlocks with a balance of 3", async () => {
    const initialBalance = 3;

    vi.spyOn(creditRepo, "getBalance").mockResolvedValue({
      customerAccountId,
      balance: initialBalance,
      version: 1,
      updatedAt: new Date().toISOString(),
    });

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
          listingNumber: "L-1",
          customerAccountId,
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
