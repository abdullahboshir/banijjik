import { EXPENSE_PAID_VIA, type ExpensePaidVia } from "@banijjik/contracts/accounting";
import type { CurrencyCode } from "@banijjik/contracts";
import { moneyFromInput } from "@banijjik/web-client";
import type { FieldErrors } from "../auth/field-errors";
import type { ExpenseCreateBody } from "./expense-api";

export const EXPENSE_FORM_NAMES = [
  "amount",
  "expenseCategoryId",
  "paidVia",
  "businessDate",
  "locationId",
  "note",
  "attachmentFileIds",
] as const;

const REQUIRED_KEY = "validation.required";
const INVALID_KEY = "validation.invalid_format";

export interface ExpenseFormState {
  amount: string;
  expenseCategoryId: string;
  paidVia: ExpensePaidVia;
  businessDate: string;
  locationId: string;
  note: string;
  attachmentFileIds: string[];
}

export function emptyExpenseForm(defaults: {
  locationId: string;
  businessDate: string;
  paidVia?: ExpensePaidVia;
}): ExpenseFormState {
  return {
    amount: "",
    expenseCategoryId: "",
    paidVia: defaults.paidVia ?? EXPENSE_PAID_VIA.CASH,
    businessDate: defaults.businessDate,
    locationId: defaults.locationId,
    note: "",
    attachmentFileIds: [],
  };
}

export type BuildExpenseResult =
  { ok: true; body: ExpenseCreateBody } | { ok: false; errors: FieldErrors };

function isPaidVia(value: string): value is ExpensePaidVia {
  return (Object.values(EXPENSE_PAID_VIA) as string[]).includes(value);
}

function collectExpenseErrors(
  form: ExpenseFormState,
  currency: CurrencyCode,
): { errors: FieldErrors; money: ReturnType<typeof moneyFromInput> } {
  const errors: FieldErrors = {};
  const money = moneyFromInput(form.amount, currency);
  if (form.amount.trim() === "") errors["amount"] = REQUIRED_KEY;
  else if (money === undefined || money.amount <= 0) errors["amount"] = INVALID_KEY;
  if (form.expenseCategoryId.trim() === "") errors["expenseCategoryId"] = REQUIRED_KEY;
  if (!isPaidVia(form.paidVia)) errors["paidVia"] = INVALID_KEY;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(form.businessDate)) errors["businessDate"] = INVALID_KEY;
  if (form.locationId.trim() === "") errors["locationId"] = REQUIRED_KEY;
  return { errors, money };
}

/** Builds the create body; empty required fields become field errors. */
export function buildExpenseCreate(
  form: ExpenseFormState,
  currency: CurrencyCode,
): BuildExpenseResult {
  const { errors, money } = collectExpenseErrors(form, currency);
  if (money === undefined || Object.keys(errors).length > 0) return { ok: false, errors };
  const note = form.note.trim();
  return {
    ok: true,
    body: {
      expenseCategoryId: form.expenseCategoryId,
      amount: money,
      paidVia: form.paidVia,
      businessDate: form.businessDate,
      locationId: form.locationId,
      ...(note === "" ? {} : { note }),
      attachmentFileIds: form.attachmentFileIds,
    },
  };
}
