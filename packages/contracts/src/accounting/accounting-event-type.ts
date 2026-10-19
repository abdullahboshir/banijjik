/** Events of the accounting and expense modules (`<module>.<entity>.<pastTenseVerb>`). */
export const ACCOUNTING_EVENT_TYPE = Object.freeze({
  JOURNAL_POSTED: "accounting.journal.posted",
} as const);

export type AccountingEventType =
  (typeof ACCOUNTING_EVENT_TYPE)[keyof typeof ACCOUNTING_EVENT_TYPE];

export const EXPENSE_EVENT_TYPE = Object.freeze({
  EXPENSE_POSTED: "expense.expense.posted",
  EXPENSE_VOIDED: "expense.expense.voided",
} as const);

export type ExpenseEventType = (typeof EXPENSE_EVENT_TYPE)[keyof typeof EXPENSE_EVENT_TYPE];
