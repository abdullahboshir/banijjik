"use client";

import type { ExpenseCategoryResponse } from "@banijjik/contracts/accounting";
import type { CurrencyCode } from "@banijjik/contracts";
import { currencySymbolOf } from "@banijjik/ui";
import type { ReactElement } from "react";
import { SettingsTextField } from "../settings/settings-text-field";
import { ExpenseAttachmentFields } from "./expense-attachment-fields";
import { ExpenseFormChoices } from "./expense-form-choices";
import type { ExpenseFormState } from "./expense-form";
import type { ExpenseFormLabels, ExpenseLocationOption } from "./expense-form-sheet";
import type { useExpenseAttachments } from "./use-expense-attachments";

/** Fields of the create-expense sheet. */
export function ExpenseFormFields(props: {
  form: ExpenseFormState;
  currency: CurrencyCode;
  categories: readonly ExpenseCategoryResponse[];
  locations: readonly ExpenseLocationOption[];
  labels: ExpenseFormLabels;
  errors: Readonly<Record<string, string | undefined>>;
  attachments: ReturnType<typeof useExpenseAttachments>;
  onPatch: (changes: Partial<ExpenseFormState>) => void;
}): ReactElement {
  const { form, currency, labels, errors, attachments, onPatch } = props;
  return (
    <>
      <SettingsTextField
        fieldId="expense-amount"
        label={`${labels.amount} (${currencySymbolOf(currency)})`}
        value={form.amount}
        errorKey={errors["amount"]}
        inputMode="decimal"
        autoComplete="off"
        isRequired
        onChange={(amount) => onPatch({ amount })}
      />
      <ExpenseFormChoices
        form={form}
        categories={props.categories}
        locations={props.locations}
        labels={labels}
        errors={errors}
        onPatch={onPatch}
      />
      <SettingsTextField
        fieldId="expense-note"
        label={labels.note}
        value={form.note}
        errorKey={errors["note"]}
        autoComplete="off"
        onChange={(note) => onPatch({ note })}
      />
      <ExpenseAttachmentFields
        label={labels.attachments}
        fileIds={form.attachmentFileIds}
        attachments={attachments}
      />
    </>
  );
}
