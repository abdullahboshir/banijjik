import { defineEnum } from "../define-enum.js";

/** Domain and API message keys for accounting and expense (translated in i18n catalogs). */
export const ACCOUNTING_RULE_KEY = defineEnum([
  "unbalanced_journal",
  "system_account_immutable",
  "account_not_found",
  "journal_already_posted",
  "posting_source_missing",
]);

export type AccountingRuleKey = (typeof ACCOUNTING_RULE_KEY)[keyof typeof ACCOUNTING_RULE_KEY];

export const EXPENSE_RULE_KEY = defineEnum([
  "attachment_required",
  "too_many_attachments",
  "invalid_attachment",
  "category_archived",
  "already_voided",
  "void_reason_required",
]);

export type ExpenseRuleKey = (typeof EXPENSE_RULE_KEY)[keyof typeof EXPENSE_RULE_KEY];

export const ACCOUNTING_MESSAGE_KEYS: readonly string[] = [
  ...Object.values(ACCOUNTING_RULE_KEY).map((key) => `errors.accounting.${key}`),
  ...Object.values(EXPENSE_RULE_KEY).map((key) => `errors.expense.${key}`),
];
