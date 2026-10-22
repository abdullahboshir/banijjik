import type { Account } from "../../domain/account.entity.js";
import type { AccountId, OrganizationId, UserId } from "@banijjik/ids";
import type { AccountStatus } from "@banijjik/contracts/accounting";

export interface AccountRepository {
  reserveActive?(accountId: AccountId): Promise<boolean>;
  updateDetails?(input: {
    accountId: AccountId;
    version: number;
    name?: { bn: string; en: string } | undefined;
    status?: AccountStatus | undefined;
    actorUserId: UserId | null;
    now: Date;
  }): Promise<boolean>;

  listPage?(
    page: number,
    limit: number,
    accountId?: string | undefined,
  ): Promise<{ items: Account[]; hasNext: boolean }>;
  insert(account: Account): Promise<"inserted" | "duplicate">;
  findByCode(accountCode: string): Promise<Account | undefined>;
  findById(accountId: AccountId): Promise<Account | undefined>;
  listAll?(): Promise<Account[]>;
  listActive(): Promise<Account[]>;
  countSystemAccounts(): Promise<number>;
  listByOrganization(organizationId: OrganizationId): Promise<Account[]>;
}
