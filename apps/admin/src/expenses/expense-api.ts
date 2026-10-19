import type { ExpenseCategoryResponse, ExpenseResponse } from "@banijjik/contracts/accounting";
import { apiFetch } from "../lib/api/api-client";

function expensesPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/expenses${suffix}`;
}

function categoriesPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/expense-categories${suffix}`;
}

export interface ExpenseCreateBody {
  readonly expenseCategoryId: string;
  readonly amount: { readonly amount: number; readonly currency: string };
  readonly paidVia: string;
  readonly businessDate: string;
  readonly locationId: string;
  readonly note?: string;
  readonly attachmentFileIds: readonly string[];
}

/** `POST /orgs/{organizationId}/expenses`; retries reuse the same Idempotency-Key. */
export async function createExpense(
  organizationId: string,
  body: ExpenseCreateBody,
  idempotencyKey: string,
): Promise<ExpenseResponse> {
  const result = await apiFetch<ExpenseResponse>(expensesPath(organizationId), {
    method: "POST",
    body,
    idempotencyKey,
  });
  return result.data;
}

export async function voidExpense(
  organizationId: string,
  expenseId: string,
  body: { readonly reason: string; readonly version: number },
): Promise<ExpenseResponse> {
  const result = await apiFetch<ExpenseResponse>(
    expensesPath(organizationId, `/${expenseId}/void`),
    { method: "POST", body },
  );
  return result.data;
}

export async function createExpenseCategory(
  organizationId: string,
  body: { readonly name: { readonly bn: string; readonly en: string } },
): Promise<ExpenseCategoryResponse> {
  const result = await apiFetch<ExpenseCategoryResponse>(categoriesPath(organizationId), {
    method: "POST",
    body,
  });
  return result.data;
}

export async function updateExpenseCategory(
  organizationId: string,
  expenseCategoryId: string,
  body: {
    readonly name: { readonly bn: string; readonly en: string };
    readonly version?: number;
  },
): Promise<ExpenseCategoryResponse> {
  const result = await apiFetch<ExpenseCategoryResponse>(
    categoriesPath(organizationId, `/${expenseCategoryId}`),
    { method: "PATCH", body },
  );
  return result.data;
}

export async function archiveExpenseCategory(
  organizationId: string,
  expenseCategoryId: string,
  version?: number,
): Promise<ExpenseCategoryResponse> {
  const result = await apiFetch<ExpenseCategoryResponse>(
    categoriesPath(organizationId, `/${expenseCategoryId}/archive`),
    { method: "POST", body: version === undefined ? {} : { version } },
  );
  return result.data;
}
