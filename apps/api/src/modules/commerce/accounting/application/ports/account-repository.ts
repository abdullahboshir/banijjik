import type { Account } from "../../domain/account.entity.js";
import type { AccountId, OrganizationId } from "@banijjik/ids";
import type { AccountStatus, AccountType } from "@banijjik/contracts/accounting";

export interface AccountRepository {
  insert(account: Account): Promise<"inserted" | "duplicate">;
  findByCode(accountCode: string): Promise<Account | undefined>;
  findById(accountId: AccountId): Promise<Account | undefined>;
  listActive(): Promise<Account[]>;
  countSystemAccounts(): Promise<number>;
  updateName(
    accountId: AccountId,
    name: { readonly bn: string; readonly en: string },
  ): Promise<void>;
  updateStatus(accountId: AccountId, status: AccountStatus): Promise<void>;
  listByOrganization(organizationId: OrganizationId): Promise<Account[]>;
  listByTypeAndStatus(
    organizationId: OrganizationId,
    accountType: AccountType,
    status: AccountStatus,
  ): Promise<Account[]>;
}
