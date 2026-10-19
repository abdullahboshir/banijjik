import type { ExpensePostingSource, ExpensePostingSnapshot } from "../../accounting/index.js";
import type { ExpenseRepository } from "./ports/expense-repositories.js";
import type { ExpenseCategoryRepository } from "./ports/expense-repositories.js";
import { asId, type ExpenseId } from "@banijjik/ids";

/** Adapts expense aggregates for the accounting posting engine (import via index). */
export function buildExpensePostingSource(input: {
  readonly expenses: ExpenseRepository;
  readonly categories: ExpenseCategoryRepository;
}): ExpensePostingSource {
  return {
    async readExpense(expenseId: string): Promise<ExpensePostingSnapshot | undefined> {
      const expense = await input.expenses.findById(asId<ExpenseId>(expenseId));
      if (expense === undefined) return undefined;
      const category = await input.categories.findById(expense.expenseCategoryId);
      if (category === undefined) return undefined;
      return {
        expenseId: expense.expenseId,
        businessDate: expense.businessDate,
        locationId: expense.locationId,
        amount: expense.amount,
        paidVia: expense.paidVia,
        categoryAccountCode: category.accountCode,
        status: expense.status,
      };
    },
  };
}
