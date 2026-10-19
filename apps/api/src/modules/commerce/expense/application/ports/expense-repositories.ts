import type { ExpenseCategoryId, ExpenseId } from "@banijjik/ids";
import type { ExpenseCategory } from "../../domain/expense-category.entity.js";
import type { Expense } from "../../domain/expense.entity.js";

export interface ExpenseListFilter {
  readonly locationId?: string | undefined;
  readonly expenseCategoryId?: string | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly page: number;
  readonly limit: number;
}

export interface ExpenseCategoryRepository {
  insert(category: ExpenseCategory): Promise<"inserted" | "duplicate">;
  save(category: ExpenseCategory, expectedVersion: number): Promise<void>;
  findById(expenseCategoryId: ExpenseCategoryId): Promise<ExpenseCategory | undefined>;
  findByKey(categoryKey: string): Promise<ExpenseCategory | undefined>;
  list(): Promise<ExpenseCategory[]>;
}

export interface ExpenseRepository {
  insert(expense: Expense): Promise<void>;
  save(expense: Expense, expectedVersion: number): Promise<void>;
  findById(expenseId: ExpenseId): Promise<Expense | undefined>;
  list(
    filter: ExpenseListFilter,
  ): Promise<{ readonly items: Expense[]; readonly hasNext: boolean }>;
}
