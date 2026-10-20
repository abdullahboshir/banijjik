import type { CustomerAccountId } from "@banijjik/ids";
import type { CreditEntry, CreditBalance } from "../../domain/index.js";

export interface UpdateBalanceInput {
  readonly customerAccountId: CustomerAccountId;
  readonly expectedVersion: number;
  readonly delta: number;
}

export interface CreditRepository {
  insertEntry(entry: CreditEntry): Promise<void>;
  listEntries(
    customerAccountId: CustomerAccountId,
    options: { limit: number; offset: number },
  ): Promise<readonly CreditEntry[]>;
  getBalance(customerAccountId: CustomerAccountId): Promise<CreditBalance | null>;
  insertBalance(balance: CreditBalance): Promise<void>;
  updateBalance(input: UpdateBalanceInput): Promise<CreditBalance>;
  findPurchaseEntry(purchaseEntryId: string): Promise<CreditEntry | null>;
}
