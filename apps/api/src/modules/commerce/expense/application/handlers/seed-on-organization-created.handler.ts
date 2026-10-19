import { EVENT_TYPE, MODULE_KEY } from "@banijjik/contracts";
import { asId, type OrganizationId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { CategoryAccountWriter } from "../seed-expense-categories.js";
import { seedExpenseCategories } from "../seed-expense-categories.js";
import type { ExpenseCategoryRepository } from "../ports/expense-repositories.js";

export function buildExpenseSeedOnOrganizationCreatedHandler(input: {
  readonly categories: ExpenseCategoryRepository;
  readonly accounts: CategoryAccountWriter;
  readonly clock: Clock;
}): EventHandler<typeof EVENT_TYPE.ORGANIZATION_CREATED> {
  return {
    handlerKey: "expense.seedCategories",
    moduleKey: MODULE_KEY.EXPENSE,
    eventType: EVENT_TYPE.ORGANIZATION_CREATED,
    ordering: "UNORDERED",
    async handle(envelope) {
      await seedExpenseCategories(
        {
          categories: input.categories,
          accounts: input.accounts,
          clock: input.clock,
        },
        {
          organizationId: asId<OrganizationId>(envelope.payload.organizationId),
          actorUserId: null,
        },
      );
    },
  };
}
