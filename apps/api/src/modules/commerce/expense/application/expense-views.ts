import type { ExpenseCategoryResponse, ExpenseResponse } from "@banijjik/contracts/accounting";
import type { ExpenseCategory } from "../domain/expense-category.entity.js";
import type { Expense } from "../domain/expense.entity.js";

export function toExpenseResponse(expense: Expense): ExpenseResponse {
  return {
    expenseId: expense.expenseId,
    expenseNumber: expense.expenseNumber,
    expenseCategoryId: expense.expenseCategoryId,
    amount: expense.amount,
    paidVia: expense.paidVia,
    businessDate: expense.businessDate,
    locationId: expense.locationId,
    note: expense.note,
    attachmentFileIds: expense.attachmentFileIds,
    status: expense.status,
    customFields: expense.customFields,
    version: expense.version,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

export function toCategoryResponse(category: ExpenseCategory): ExpenseCategoryResponse {
  return {
    expenseCategoryId: category.expenseCategoryId,
    name: category.name,
    accountId: category.accountId,
    accountCode: category.accountCode,
    status: category.status,
    isSystem: category.isSystem,
  };
}
