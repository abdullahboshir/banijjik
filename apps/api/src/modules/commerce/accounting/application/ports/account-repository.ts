import type { Account } from "../../domain/account.entity.js";
import type { AccountId } from "@banijjik/ids";

export interface AccountRepository {
  insert(account: Account): Promise<"inserted" | "duplicate">;
  findByCode(accountCode: string): Promise<Account | undefined>;
  findById(accountId: AccountId): Promise<Account | undefined>;
  listActive(): Promise<Account[]>;
  countSystemAccounts(): Promise<number>;
}
