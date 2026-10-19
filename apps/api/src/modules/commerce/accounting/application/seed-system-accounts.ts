import { SYSTEM_ACCOUNT_SEEDS } from "@banijjik/contracts/accounting";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { Clock } from "../../../../kernel/time/index.js";
import { Account } from "../domain/account.entity.js";
import type { AccountRepository } from "./ports/account-repository.js";

export interface SeedSystemAccountsDependencies {
  readonly accounts: AccountRepository;
  readonly clock: Clock;
}

/**
 * Inserts every system account for the organization. Safe to run twice: unique (organizationId,
 * accountCode) turns a second insert into a no-op (ADR-124).
 */
export async function seedSystemAccounts(
  dependencies: SeedSystemAccountsDependencies,
  input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId | null;
  },
): Promise<{ readonly inserted: number; readonly skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  const now = dependencies.clock.now();
  for (const seed of SYSTEM_ACCOUNT_SEEDS) {
    const account = Account.create({
      organizationId: input.organizationId,
      accountCode: seed.accountCode,
      name: seed.name,
      accountType: seed.accountType,
      isSystem: true,
      now,
      actorUserId: input.actorUserId,
    });
    const result = await dependencies.accounts.insert(account);
    if (result === "inserted") inserted += 1;
    else skipped += 1;
  }
  return { inserted, skipped };
}

/**
 * Seeds every organization returned by `listOrganizationIds`. Idempotent catch-up for orgs created
 * before the accounting handlers existed.
 */
export async function catchUpSystemAccounts(
  dependencies: SeedSystemAccountsDependencies,
  listOrganizationIds: () => Promise<readonly string[]>,
): Promise<{
  readonly organizations: number;
  readonly inserted: number;
  readonly skipped: number;
}> {
  const organizationIds = await listOrganizationIds();
  let inserted = 0;
  let skipped = 0;
  for (const organizationId of organizationIds) {
    const result = await seedSystemAccounts(dependencies, {
      organizationId: asId<OrganizationId>(organizationId),
      actorUserId: null,
    });
    inserted += result.inserted;
    skipped += result.skipped;
  }
  return { organizations: organizationIds.length, inserted, skipped };
}
