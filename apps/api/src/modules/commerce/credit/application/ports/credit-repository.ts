import type { CustomerAccountId } from "@banijjik/ids";
import type { CreditEntry, CreditBalance } from "../../domain/index.js";

export interface ApplyDeltaInput {
  readonly customerAccountId: CustomerAccountId;
  readonly delta: number;
}

export interface CreditRepository {
  /** Appends a ledger row. A unique natural key rejects a repeated EXPIRE with a domain error. */
  insertEntry(entry: CreditEntry): Promise<void>;
  listEntries(
    customerAccountId: CustomerAccountId,
    options: { limit: number; offset: number },
  ): Promise<readonly CreditEntry[]>;
  getBalance(customerAccountId: CustomerAccountId): Promise<CreditBalance | null>;
  /**
   * Applies a signed delta in one conditional update: a negative delta only lands while the
   * projected balance covers it. Returns null when the balance is missing or too small.
   */
  applyDelta(input: ApplyDeltaInput): Promise<CreditBalance | null>;
  /** PURCHASE rows of the account, oldest first, for FIFO spend attribution. */
  listPurchases(customerAccountId: CustomerAccountId): Promise<readonly CreditEntry[]>;
  /** Consumed totals (SPEND and EXPIRE) keyed by purchase entry id. */
  sumSpendsByPurchase(
    customerAccountId: CustomerAccountId,
    purchaseEntryIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>>;
  /** PURCHASE rows whose expiry day is before `today`, across the organization. */
  listExpiringPurchases(today: string): Promise<readonly CreditEntry[]>;
  findPurchaseEntry(purchaseEntryId: string): Promise<CreditEntry | null>;
}
