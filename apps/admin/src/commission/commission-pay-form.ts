import type { CurrencyCode } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/accounting";
import {
  COMMISSION_PAYOUT_REFERENCE_METHODS,
  type CommissionPayoutMethod,
} from "@banijjik/contracts/commission";
import type { FieldErrors } from "../auth/field-errors";
import type { PayFormState } from "./use-commission-pay-form";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
export function validatePayoutForm(form: PayFormState, referenceRequired: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.memberId) errors.memberId = "validation.required";
  if (!form.locationId) errors.locationId = "validation.required";
  if (!ISO_DATE.test(form.upTo)) errors.upToBusinessDate = "validation.invalid_format";
  if (referenceRequired && !form.externalReference.trim())
    errors.externalReference = "validation.required";
  return errors;
}
export function buildPayoutBody(
  form: PayFormState,
  expectedTotal: Money,
): {
  memberId: string;
  locationId: string;
  upToBusinessDate: string;
  expectedTotal: Money;
  method: CommissionPayoutMethod;
  externalReference?: string;
  note?: string;
} {
  const externalReference = form.externalReference.trim();
  const note = form.note.trim();
  return {
    memberId: form.memberId,
    locationId: form.locationId,
    upToBusinessDate: form.upTo,
    expectedTotal,
    method: form.method,
    ...(externalReference ? { externalReference } : {}),
    ...(note ? { note } : {}),
  };
}
export function needsPayoutReference(method: CommissionPayoutMethod): boolean {
  return COMMISSION_PAYOUT_REFERENCE_METHODS.includes(method);
}
export function totalFromDetails(details: unknown, currency: CurrencyCode): Money | undefined {
  if (typeof details !== "object" || details === null) return undefined;
  const value = (details as Record<string, unknown>).total;
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  return typeof record.amount === "number" && record.currency === currency
    ? { amount: record.amount, currency }
    : undefined;
}
