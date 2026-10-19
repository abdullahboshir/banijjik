import { DEFAULT_EXPENSE_CATEGORY_SEEDS } from "@banijjik/contracts/accounting";
import type { LocalizedAccountName } from "@banijjik/contracts/accounting";
import { asId, type AccountId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { Clock } from "../../../../kernel/time/index.js";
import { ExpenseCategory } from "../domain/expense-category.entity.js";
import type { ExpenseCategoryRepository } from "./ports/expense-repositories.js";

/** Creates EXPENSE accounts in accounting; adapted from accounting's writer at the composition root. */
export interface CategoryAccountWriter {
  ensureExpenseAccount(input: {
    readonly organizationId: OrganizationId;
    readonly accountCode: string;
    readonly name: LocalizedAccountName;
    readonly actorUserId: UserId | null;
  }): Promise<{ readonly accountId: AccountId; readonly accountCode: string }>;
}

export interface SeedExpenseCategoriesDependencies {
  readonly categories: ExpenseCategoryRepository;
  readonly accounts: CategoryAccountWriter;
  readonly clock: Clock;
}

/** Seeds the default expense categories and their EXPENSE accounts. Idempotent by categoryKey. */
export async function seedExpenseCategories(
  dependencies: SeedExpenseCategoriesDependencies,
  input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId | null;
  },
): Promise<{ readonly inserted: number; readonly skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  for (const seed of DEFAULT_EXPENSE_CATEGORY_SEEDS) {
    const existing = await dependencies.categories.findByKey(seed.categoryKey);
    if (existing !== undefined) {
      skipped += 1;
      continue;
    }
    const account = await dependencies.accounts.ensureExpenseAccount({
      organizationId: input.organizationId,
      accountCode: seed.accountCode,
      name: seed.name,
      actorUserId: input.actorUserId,
    });
    const category = ExpenseCategory.create({
      organizationId: input.organizationId,
      name: seed.name,
      accountId: account.accountId,
      accountCode: account.accountCode,
      isSystem: true,
      categoryKey: seed.categoryKey,
      now: dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    const result = await dependencies.categories.insert(category);
    if (result === "inserted") inserted += 1;
    else skipped += 1;
  }
  return { inserted, skipped };
}

export async function catchUpExpenseCategories(
  dependencies: SeedExpenseCategoriesDependencies,
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
    const result = await seedExpenseCategories(dependencies, {
      organizationId: asId<OrganizationId>(organizationId),
      actorUserId: null,
    });
    inserted += result.inserted;
    skipped += result.skipped;
  }
  return { organizations: organizationIds.length, inserted, skipped };
}
