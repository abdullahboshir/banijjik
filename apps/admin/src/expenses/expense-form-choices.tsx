"use client";

import {
  EXPENSE_PAID_VIA,
  type ExpenseCategoryResponse,
  type ExpensePaidVia,
} from "@banijjik/contracts/accounting";
import { FormField, Select, TextInput } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import type { ExpenseFormState } from "./expense-form";
import type { ExpenseFormLabels, ExpenseLocationOption } from "./expense-form-sheet";
import { localizedNameOf } from "./expense-labels";

function ChoiceField(props: {
  fieldId: string;
  label: string;
  value: string;
  errorKey: string | undefined;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}): ReactElement {
  const { t } = useTranslator();
  return (
    <FormField
      label={props.label}
      htmlFor={props.fieldId}
      error={props.errorKey ? t(props.errorKey) : undefined}
      required
    >
      <Select
        id={props.fieldId}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

/** Category, paid-via, date and location fields of the expense sheet. */
export function ExpenseFormChoices(props: {
  form: ExpenseFormState;
  categories: readonly ExpenseCategoryResponse[];
  locations: readonly ExpenseLocationOption[];
  labels: ExpenseFormLabels;
  errors: Readonly<Record<string, string | undefined>>;
  onPatch: (changes: Partial<ExpenseFormState>) => void;
}): ReactElement {
  const { form, labels, errors, onPatch } = props;
  const { locale } = useTranslator();
  return (
    <>
      <ChoiceField
        fieldId="expense-category"
        label={labels.category}
        value={form.expenseCategoryId}
        errorKey={errors["expenseCategoryId"]}
        options={[
          { value: "", label: labels.category },
          ...props.categories.map((category) => ({
            value: category.expenseCategoryId,
            label: localizedNameOf(category.name, locale),
          })),
        ]}
        onChange={(expenseCategoryId) => onPatch({ expenseCategoryId })}
      />
      <ChoiceField
        fieldId="expense-paid-via"
        label={labels.paidVia}
        value={form.paidVia}
        errorKey={errors["paidVia"]}
        options={Object.values(EXPENSE_PAID_VIA).map((paidVia) => ({
          value: paidVia,
          label: labels.paidViaOptions[paidVia as ExpensePaidVia],
        }))}
        onChange={(paidVia) => onPatch({ paidVia: paidVia as ExpensePaidVia })}
      />
      <DateAndLocationFields
        form={form}
        labels={labels}
        errors={errors}
        locations={props.locations}
        onPatch={onPatch}
      />
    </>
  );
}

function DateAndLocationFields(props: {
  form: ExpenseFormState;
  labels: ExpenseFormLabels;
  errors: Readonly<Record<string, string | undefined>>;
  locations: readonly ExpenseLocationOption[];
  onPatch: (changes: Partial<ExpenseFormState>) => void;
}): ReactElement {
  const { form, labels, errors, onPatch } = props;
  const { t } = useTranslator();
  return (
    <>
      <FormField
        label={labels.date}
        htmlFor="expense-date"
        error={errors["businessDate"] ? t(errors["businessDate"]) : undefined}
        required
      >
        <TextInput
          id="expense-date"
          type="date"
          value={form.businessDate}
          onChange={(event) => onPatch({ businessDate: event.target.value })}
        />
      </FormField>
      <ChoiceField
        fieldId="expense-location"
        label={labels.location}
        value={form.locationId}
        errorKey={errors["locationId"]}
        options={props.locations.map((location) => ({
          value: location.locationId,
          label: location.name,
        }))}
        onChange={(locationId) => onPatch({ locationId })}
      />
    </>
  );
}
