import { ERROR_CODE } from "@banijjik/contracts";
import { SYSTEM_ACCOUNT_SEEDS, type SystemAccountCode } from "@banijjik/contracts/accounting";
import type { OrganizationId } from "@banijjik/ids";
import { AppError } from "../../../../kernel/http/index.js";
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

  const seed = SYSTEM_ACCOUNT_SEEDS.find((s) => s.accountCode === input.accountCode);
  if (seed === undefined) {
    throw new AppError({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.unknown_system_account",
      details: { accountCode: input.accountCode },
    });
  }

  const account = Account.create({
    organizationId: input.organizationId,
    accountCode: input.accountCode,
    name: seed.name,
    accountType: seed.accountType,
    isSystem: true,
    now: dependencies.clock.now(),
    actorUserId: null,
  });

  const result = await dependencies.accounts.insert(account);
  if (result === "duplicate") {
    const raced = await dependencies.accounts.findByCode(input.accountCode);
    if (raced !== undefined) return raced;
    throw new AppError({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.concurrent_system_account_creation_failed",
      details: { accountCode: input.accountCode },
    });
  }
  return account;
}
