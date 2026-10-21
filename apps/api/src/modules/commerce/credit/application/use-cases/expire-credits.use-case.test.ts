import { CREDIT_ENTRY_TYPE, CREDIT_SOURCE_TYPE } from "@banijjik/contracts/credit";
import { asId, newId, type CustomerAccountId } from "@banijjik/ids";
import { describe, expect, it, vi } from "vitest";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import {
  CreditEntryAlreadyExistsError,
  type CreditBalance,
  type CreditEntry,
} from "../../domain/index.js";
import { ExpireCreditsUseCase } from "./expire-credits.use-case.js";

const CUSTOMER_ACCOUNT_ID = asId<CustomerAccountId>(newId());
const NOW = new Date("2026-10-21T08:00:00.000Z");

function purchaseEntry(input: {
  readonly creditEntryId: string;
  readonly credits?: number;
  readonly expiresOn?: string;
  readonly occurredAt?: string;
  readonly customerAccountId?: CustomerAccountId;
}): CreditEntry {
  return {
    creditEntryId: input.creditEntryId,
    customerAccountId: input.customerAccountId ?? CUSTOMER_ACCOUNT_ID,
    type: CREDIT_ENTRY_TYPE.PURCHASE,
    credits: input.credits ?? 10,
    expiresOn: input.expiresOn ?? "2026-10-20T00:00:00.000Z",
    source: { sourceType: CREDIT_SOURCE_TYPE.PAYMENT, sourceId: `payment-${input.creditEntryId}` },
    fromPurchaseEntryId: null,
    reason: null,
    createdByUserId: null,
    occurredAt: input.occurredAt ?? "2026-10-01T00:00:00.000Z",
    businessDate: "2026-10-01",
    createdAt: "2026-10-01T00:00:00.000Z",
  };
}

interface Ledger {
  readonly deps: CreditDependencies;
  readonly entries: CreditEntry[];
  readonly balance: { value: number };
}

/** A transaction that really rolls back, so a duplicate in the middle leaves no partial charge. */
function aLedger(input: {
  readonly purchases: readonly CreditEntry[];
  readonly spentByPurchase?: Readonly<Record<string, number>>;
  readonly balance: number;
}): Ledger {
  const entries: CreditEntry[] = [];
  const balance = { value: input.balance };
  const expiresSeen = new Set<string>();

  function snapshot() {
    return { entries: [...entries], balance: balance.value, expiresSeen: new Set(expiresSeen) };
  }

  function restore(state: ReturnType<typeof snapshot>): void {
    entries.splice(0, entries.length, ...state.entries);
    balance.value = state.balance;
    expiresSeen.clear();
    for (const id of state.expiresSeen) expiresSeen.add(id);
  }

  const credit = {
    insertEntry: vi.fn(async (entry: CreditEntry) => {
      if (entry.type === CREDIT_ENTRY_TYPE.EXPIRE) {
        if (expiresSeen.has(entry.source.sourceId)) throw new CreditEntryAlreadyExistsError();
        expiresSeen.add(entry.source.sourceId);
      }
      entries.push(entry);
    }),
    listEntries: vi.fn(async () => entries),
    getBalance: vi.fn(async (): Promise<CreditBalance | null> => ({
      customerAccountId: CUSTOMER_ACCOUNT_ID,
      balance: balance.value,
      version: 1,
      updatedAt: NOW.toISOString(),
    })),
    applyDelta: vi.fn(
      async (deltaInput: { customerAccountId: CustomerAccountId; delta: number }) => {
        if (balance.value + deltaInput.delta < 0) return null;
        balance.value += deltaInput.delta;
        return {
          customerAccountId: deltaInput.customerAccountId,
          balance: balance.value,
          version: 1,
          updatedAt: NOW.toISOString(),
        };
      },
    ),
    listPurchases: vi.fn(async () => input.purchases),
    sumSpendsByPurchase: vi.fn(async () => new Map(Object.entries(input.spentByPurchase ?? {}))),
    listExpiringPurchases: vi.fn(async () => input.purchases),
    findPurchaseEntry: vi.fn(async () => null),
  };

  const unitOfWork = {
    run: vi.fn(async <Result>(work: () => Promise<Result>): Promise<Result> => {
      const state = snapshot();
      try {
        return await work();
      } catch (error) {
        restore(state);
        throw error;
      }
    }),
  };

  const deps = {
    credit,
    unitOfWork,
    events: { publish: vi.fn(async () => undefined) },
    clock: { now: () => NOW },
  } as unknown as CreditDependencies;

  return { deps, entries, balance };
}

describe("ExpireCreditsUseCase", () => {
  it("writes one EXPIRE for the unused remainder and is idempotent on a second run", async () => {
    const ledger = aLedger({
      purchases: [purchaseEntry({ creditEntryId: "purchase-1" })],
      balance: 10,
    });
    const useCase = new ExpireCreditsUseCase(ledger.deps);

    const first = await useCase.execute();
    expect(first.expiredEntries).toBe(1);
    expect(ledger.balance.value).toBe(0);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]).toMatchObject({
      type: CREDIT_ENTRY_TYPE.EXPIRE,
      credits: -10,
      fromPurchaseEntryId: "purchase-1",
      source: { sourceType: CREDIT_SOURCE_TYPE.EXPIRY_JOB, sourceId: "purchase-1" },
      businessDate: "2026-10-21",
    });

    const second = await useCase.execute();
    expect(second.expiredEntries).toBe(0);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.balance.value).toBe(0);
  });

  it("expires only what the attributed spends left unused", async () => {
    const ledger = aLedger({
      purchases: [purchaseEntry({ creditEntryId: "purchase-1", credits: 10 })],
      spentByPurchase: { "purchase-1": 4 },
      balance: 6,
    });

    const result = await new ExpireCreditsUseCase(ledger.deps).execute();

    expect(result.expiredEntries).toBe(1);
    expect(ledger.entries[0]?.credits).toBe(-6);
    expect(ledger.balance.value).toBe(0);
  });

  it("writes nothing for a purchase that was spent completely", async () => {
    const ledger = aLedger({
      purchases: [purchaseEntry({ creditEntryId: "purchase-1", credits: 10 })],
      spentByPurchase: { "purchase-1": 10 },
      balance: 0,
    });

    const result = await new ExpireCreditsUseCase(ledger.deps).execute();

    expect(result.expiredEntries).toBe(0);
    expect(ledger.entries).toHaveLength(0);
  });

  it("skips a purchase the projected balance can no longer cover", async () => {
    const ledger = aLedger({
      purchases: [purchaseEntry({ creditEntryId: "purchase-1" })],
      balance: 3,
    });

    const result = await new ExpireCreditsUseCase(ledger.deps).execute();

    expect(result.expiredEntries).toBe(0);
    expect(ledger.entries).toHaveLength(0);
    expect(ledger.balance.value).toBe(3);
  });

  it("expires every expired purchase of the account and debits their total once", async () => {
    const ledger = aLedger({
      purchases: [
        purchaseEntry({ creditEntryId: "purchase-1" }),
        purchaseEntry({ creditEntryId: "purchase-2", occurredAt: "2026-10-02T00:00:00.000Z" }),
      ],
      balance: 20,
    });

    const result = await new ExpireCreditsUseCase(ledger.deps).execute();

    expect(result.expiredEntries).toBe(2);
    expect(ledger.entries.map((entry) => entry.source.sourceId)).toEqual([
      "purchase-1",
      "purchase-2",
    ]);
    expect(ledger.balance.value).toBe(0);
  });
});
