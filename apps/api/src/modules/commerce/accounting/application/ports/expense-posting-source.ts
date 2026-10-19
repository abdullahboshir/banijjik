import type { ExpensePostingSnapshot } from "../../domain/posting-rules.js";

/** Reads expense aggregates for posting and void reversal. Implemented by the expense module. */
export interface ExpensePostingSource {
  readExpense(expenseId: string): Promise<ExpensePostingSnapshot | undefined>;
}
