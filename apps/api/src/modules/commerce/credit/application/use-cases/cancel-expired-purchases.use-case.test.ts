import { CREDIT_PURCHASE_METHOD, CREDIT_PURCHASE_STATUS } from "@banijjik/contracts/credit";
import {
  asId,
  newId,
  type CreditPurchaseId,
  type CustomerAccountId,
  type OrganizationId,
} from "@banijjik/ids";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../../kernel/http/index.js";
import { ERROR_CODE } from "@banijjik/contracts";
import { CreditPurchase } from "../../domain/index.js";
import type {
  ExpiredPurchaseBatch,
  ExpiredPurchaseCursor,
} from "../ports/credit-purchase-repository.js";
import {
  CancelExpiredPurchasesUseCase,
  type CancelExpiredPurchasesDependencies,
} from "./cancel-expired-purchases.use-case.js";

const NOW = new Date("2026-10-21T08:00:00.000Z");
const EXPIRED_AT = new Date("2026-10-20T08:00:00.000Z");

function expiredPurchase(reference: string): CreditPurchase {
  return CreditPurchase.create({
    organizationId: asId<OrganizationId>(newId()),
    purchaseNumber: `CP-${reference}`,
    customerAccountId: asId<CustomerAccountId>(newId()),
    creditPackId: newId(),
    snapshot: {
      name: { bn: "প্যাক", en: "Pack" },
      credits: 10,
      price: { amount: 5000, currency: "BDT" },
      validityDays: null,
    },
    method: CREDIT_PURCHASE_METHOD.BKASH,
    senderPhoneE164: "+8801711000000",
    transactionReference: reference,
    submittedAt: new Date("2026-10-10T08:00:00.000Z"),
    expiresAt: EXPIRED_AT,
  });
}

function verifiedCopy(purchase: CreditPurchase): CreditPurchase {
  return purchase.verify({
    verifiedByUserId: newId(),
    verifiedAt: NOW,
    creditEntryId: newId(),
  });
}

interface Harness {
  readonly deps: CancelExpiredPurchasesDependencies;
  readonly stored: Map<string, CreditPurchase>;
  readonly updateVersioned: ReturnType<typeof vi.fn>;
  readonly listBatch: ReturnType<typeof vi.fn>;
}

function buildHarness(input: {
  readonly listed: readonly CreditPurchase[];
  readonly stored: readonly CreditPurchase[];
  readonly failUpdateFor?: ReadonlySet<string>;
  readonly batchSize?: number;
}): Harness {
  const stored = new Map(input.stored.map((purchase) => [purchase.creditPurchaseId, purchase]));
  const batchSize = input.batchSize ?? input.listed.length + 1;
  // Serves the listed rows in fixed-size batches, like the keyset query does.
  const listBatch = vi.fn(
    async (_now: Date, after: ExpiredPurchaseCursor | null): Promise<ExpiredPurchaseBatch> => {
      const start = after
        ? input.listed.findIndex((p) => p.creditPurchaseId === after.creditPurchaseId) + 1
        : 0;
      const items = input.listed.slice(start, start + batchSize);
      const last = items[items.length - 1];
      const hasMore = start + batchSize < input.listed.length && last !== undefined;
      return {
        items,
        nextCursor: hasMore
          ? { expiresAt: last.expiresAt, creditPurchaseId: last.creditPurchaseId }
          : null,
      };
    },
  );
  const updateVersioned = vi.fn(async (purchase: CreditPurchase) => {
    if (input.failUpdateFor?.has(purchase.creditPurchaseId)) {
      throw new AppError({ code: ERROR_CODE.CONFLICT, details: { currentVersion: 2 } });
    }
    stored.set(purchase.creditPurchaseId, purchase);
  });
  const deps: CancelExpiredPurchasesDependencies = {
    purchases: {
      insert: vi.fn(),
      updateVersioned,
      findById: vi.fn(async (creditPurchaseId: CreditPurchaseId) => stored.get(creditPurchaseId)),
      findByReference: vi.fn(),
      listByAccount: vi.fn(),
      countPendingByAccount: vi.fn(),
      listForStaff: vi.fn(),
      listExpiredPendingBatch: listBatch,
    },
    unitOfWork: { run: async (work) => work() },
    audit: { record: vi.fn(async () => undefined) },
    events: { publish: vi.fn(async () => undefined) },
  };
  return { deps, stored, updateVersioned, listBatch };
}

describe("CancelExpiredPurchasesUseCase", () => {
  it("processes each keyset batch on its own and cancels rows from every batch", async () => {
    const purchases = ["E1", "E2", "E3", "E4", "E5"].map(expiredPurchase);
    const { deps, stored, listBatch } = buildHarness({
      listed: purchases,
      stored: purchases,
      batchSize: 2,
    });

    const cancelled = await new CancelExpiredPurchasesUseCase(deps).execute(NOW);

    expect(cancelled).toBe(5);
    expect(listBatch).toHaveBeenCalledTimes(3);
    expect(listBatch.mock.calls[0]?.[1]).toBeNull();
    expect(listBatch.mock.calls[1]?.[1]?.creditPurchaseId).toBe(purchases[1]?.creditPurchaseId);
    expect(listBatch.mock.calls[2]?.[1]?.creditPurchaseId).toBe(purchases[3]?.creditPurchaseId);
    for (const purchase of purchases) {
      expect(stored.get(purchase.creditPurchaseId)?.status).toBe(CREDIT_PURCHASE_STATUS.CANCELLED);
    }
  });

  it("cancels every expired PENDING purchase", async () => {
    const first = expiredPurchase("A1");
    const second = expiredPurchase("A2");
    const { deps, stored } = buildHarness({ listed: [first, second], stored: [first, second] });

    const cancelled = await new CancelExpiredPurchasesUseCase(deps).execute(NOW);

    expect(cancelled).toBe(2);
    expect(stored.get(first.creditPurchaseId)?.status).toBe(CREDIT_PURCHASE_STATUS.CANCELLED);
    expect(stored.get(second.creditPurchaseId)?.status).toBe(CREDIT_PURCHASE_STATUS.CANCELLED);
  });

  it("skips a purchase that staff verified after the job listed it, and keeps going", async () => {
    const raced = expiredPurchase("B1");
    const other = expiredPurchase("B2");
    const { deps, stored, updateVersioned } = buildHarness({
      listed: [raced, other],
      stored: [verifiedCopy(raced), other],
    });

    const cancelled = await new CancelExpiredPurchasesUseCase(deps).execute(NOW);

    expect(cancelled).toBe(1);
    expect(stored.get(raced.creditPurchaseId)?.status).toBe(CREDIT_PURCHASE_STATUS.VERIFIED);
    expect(stored.get(other.creditPurchaseId)?.status).toBe(CREDIT_PURCHASE_STATUS.CANCELLED);
    expect(updateVersioned).toHaveBeenCalledTimes(1);
  });

  it("treats a conflict on one row as skip-this-row and cancels the others", async () => {
    const raced = expiredPurchase("C1");
    const other = expiredPurchase("C2");
    const { deps, stored } = buildHarness({
      listed: [raced, other],
      stored: [raced, other],
      failUpdateFor: new Set([raced.creditPurchaseId]),
    });

    const cancelled = await new CancelExpiredPurchasesUseCase(deps).execute(NOW);

    expect(cancelled).toBe(1);
    expect(stored.get(raced.creditPurchaseId)?.status).toBe(CREDIT_PURCHASE_STATUS.PENDING);
    expect(stored.get(other.creditPurchaseId)?.status).toBe(CREDIT_PURCHASE_STATUS.CANCELLED);
  });

  it("does not hide an infrastructure error", async () => {
    const purchase = expiredPurchase("D1");
    const { deps, updateVersioned } = buildHarness({ listed: [purchase], stored: [purchase] });
    updateVersioned.mockRejectedValueOnce(new Error("connection lost"));

    await expect(new CancelExpiredPurchasesUseCase(deps).execute(NOW)).rejects.toThrow(
      "connection lost",
    );
  });
});
