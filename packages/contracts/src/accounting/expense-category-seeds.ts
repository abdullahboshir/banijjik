import {
  DEFAULT_EXPENSE_CATEGORY_KEY,
  type DefaultExpenseCategoryKey,
} from "./expense-contracts.js";

export interface ExpenseCategorySeed {
  readonly categoryKey: DefaultExpenseCategoryKey;
  readonly accountCode: string;
  readonly name: { readonly bn: string; readonly en: string };
}

/** Default expense categories and the EXPENSE account code each creates (09 ExpenseCategory). */
export const DEFAULT_EXPENSE_CATEGORY_SEEDS: readonly ExpenseCategorySeed[] = Object.freeze([
  {
    categoryKey: DEFAULT_EXPENSE_CATEGORY_KEY.rent,
    accountCode: "EXPENSE_RENT",
    name: { bn: "ভাড়া", en: "Rent" },
  },
  {
    categoryKey: DEFAULT_EXPENSE_CATEGORY_KEY.salary,
    accountCode: "EXPENSE_SALARY",
    name: { bn: "বেতন", en: "Salary" },
  },
  {
    categoryKey: DEFAULT_EXPENSE_CATEGORY_KEY.utilities,
    accountCode: "EXPENSE_UTILITIES",
    name: { bn: "ইউটিলিটি", en: "Utilities" },
  },
  {
    categoryKey: DEFAULT_EXPENSE_CATEGORY_KEY.delivery,
    accountCode: "EXPENSE_DELIVERY",
    name: { bn: "ডেলিভারি", en: "Delivery" },
  },
  {
    categoryKey: DEFAULT_EXPENSE_CATEGORY_KEY.marketing,
    accountCode: "EXPENSE_MARKETING",
    name: { bn: "মার্কেটিং", en: "Marketing" },
  },
  {
    categoryKey: DEFAULT_EXPENSE_CATEGORY_KEY.other,
    accountCode: "EXPENSE_OTHER",
    name: { bn: "অন্যান্য", en: "Other" },
  },
]);
