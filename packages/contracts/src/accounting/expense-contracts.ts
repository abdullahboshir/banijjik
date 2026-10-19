import { defineEnum } from "../define-enum.js";
import type { Money } from "./accounting-contracts.js";

export const EXPENSE_STATUS = defineEnum(["POSTED", "VOIDED"]);
export type ExpenseStatus = (typeof EXPENSE_STATUS)[keyof typeof EXPENSE_STATUS];

export const EXPENSE_PAID_VIA = defineEnum(["CASH", "BKASH", "NAGAD", "BANK", "CARD"]);
export type ExpensePaidVia = (typeof EXPENSE_PAID_VIA)[keyof typeof EXPENSE_PAID_VIA];

export const EXPENSE_CATEGORY_STATUS = defineEnum(["ACTIVE", "ARCHIVED"]);
export type ExpenseCategoryStatus =
  (typeof EXPENSE_CATEGORY_STATUS)[keyof typeof EXPENSE_CATEGORY_STATUS];

/** Seeded per organization; each gets its own EXPENSE account in accounting. */
export const DEFAULT_EXPENSE_CATEGORY_KEY = defineEnum([
  "rent",
  "salary",
  "utilities",
  "delivery",
  "marketing",
  "other",
]);
export type DefaultExpenseCategoryKey =
  (typeof DEFAULT_EXPENSE_CATEGORY_KEY)[keyof typeof DEFAULT_EXPENSE_CATEGORY_KEY];

export const EXPENSE_REQUIRE_ATTACHMENT_ABOVE_SETTING_KEY = "expense.requireAttachmentAbove";

/** Default: never require an attachment (amount 0 with currency from the org). */
export const EXPENSE_REQUIRE_ATTACHMENT_ABOVE_DEFAULT: Money = { amount: 0, currency: "BDT" };

export const MAX_EXPENSE_ATTACHMENTS = 5;

export interface ExpenseCategoryResponse {
  readonly expenseCategoryId: string;
  readonly name: { readonly bn: string; readonly en: string };
  readonly accountId: string;
  readonly accountCode: string;
  readonly status: ExpenseCategoryStatus;
  readonly isSystem: boolean;
}

export interface ExpenseResponse {
  readonly expenseId: string;
  readonly expenseNumber: string;
  readonly expenseCategoryId: string;
  readonly amount: Money;
  readonly paidVia: ExpensePaidVia;
  readonly businessDate: string;
  readonly locationId: string;
  readonly note: string | null;
  readonly attachmentFileIds: readonly string[];
  readonly status: ExpenseStatus;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
