import { ACCOUNT_TYPE, type SystemAccountCode } from "@banijjik/contracts/accounting";
import type { OrganizationId } from "@banijjik/ids";
import type { Clock } from "../../../../kernel/time/index.js";
import { Account } from "../domain/account.entity.js";
import type { AccountRepository } from "./ports/account-repository.js";

export interface EnsureSystemAccountDependencies {
  readonly accounts: AccountRepository;
  readonly clock: Clock;
}

/**
 * Ensures a system account exists for the organization.
 * Used for accounts added after initial organization creation (e.g. ACCOUNTS_PAYABLE).
 */
export async function ensureSystemAccount(
  dependencies: EnsureSystemAccountDependencies,
  input: {
    readonly organizationId: OrganizationId;
    readonly accountCode: SystemAccountCode;
  },
): Promise<Account> {
  const existing = await dependencies.accounts.findByCode(input.accountCode);
  if (existing !== undefined) {
    return existing;
  }

  const account = Account.create({
    organizationId: input.organizationId,
    accountCode: input.accountCode,
    name: { bn: "প্রদেয় হিসাব", en: "Accounts payable" },
    accountType: ACCOUNT_TYPE.LIABILITY,
    isSystem: true,
    now: dependencies.clock.now(),
    actorUserId: null,
  });

  const result = await dependencies.accounts.insert(account);
  if (result === "duplicate") {
    const raced = await dependencies.accounts.findByCode(input.accountCode);
    if (raced !== undefined) return raced;
  }
  return account;
}
