import type { ReactElement } from "react";
import { FormField } from "./form.js";
import {
  BooleanControl,
  DateControl,
  DateTimeControl,
  DecimalControl,
  IntegerControl,
  LongTextControl,
  MoneyControl,
  MultiSelectControl,
  SelectControl,
  TextLikeControl,
  type CustomFieldControlProps,
} from "./custom-field-controls.js";
import { ContactLinkControl } from "./custom-field-contact-control.js";
import { FileControl, ImageControl } from "./custom-field-file-controls.js";
import type {
  CustomFieldInputKind,
  CustomFieldInputsProps,
  PendingCustomField,
} from "./custom-field-types.js";

const DEFAULT_MONEY_FRACTION_DIGITS = 2;

interface FieldRowProps {
  readonly field: CustomFieldInputsProps["fields"][number];
  readonly value: unknown;
  readonly error: string | undefined;
  readonly onChange: CustomFieldInputsProps["onChange"];
  readonly inputId: string;
  readonly disabled: boolean;
  readonly currencySymbol: string;
  readonly moneyFractionDigits: number;
  readonly chooseLabel: string;
  readonly files: CustomFieldInputsProps["files"];
  readonly contactLink: CustomFieldInputsProps["contactLink"];
}

function FieldRow(props: FieldRowProps): ReactElement {
  const Control = CONTROLS[props.field.inputKind];
  return (
    <FormField
      label={props.field.label}
      htmlFor={props.inputId}
      error={props.error}
      hint={props.field.hint}
      required={props.field.isRequired}
    >
      <Control
        fieldKey={props.field.fieldKey}
        inputKind={props.field.inputKind}
        label={props.field.label}
        hint={props.field.hint}
        options={props.field.options}
        maxLength={props.field.maxLength}
        isRequired={props.field.isRequired}
        value={props.value}
        error={props.error}
        onValueChange={(value) => props.onChange(props.field.fieldKey, value)}
        inputId={props.inputId}
        disabled={props.disabled}
        currencySymbol={props.currencySymbol}
        moneyFractionDigits={props.moneyFractionDigits}
        chooseLabel={props.chooseLabel}
        files={props.files}
        contactLink={props.contactLink}
      />
    </FormField>
  );
}

const CONTROLS: Record<CustomFieldInputKind, (props: CustomFieldControlProps) => ReactElement> = {
  TEXT: TextLikeControl,
  LONG_TEXT: LongTextControl,
  INTEGER: IntegerControl,
  DECIMAL: DecimalControl,
  MONEY: MoneyControl,
  BOOLEAN: BooleanControl,
  DATE: DateControl,
  DATETIME: DateTimeControl,
  SELECT: SelectControl,
  MULTI_SELECT: MultiSelectControl,
  PHONE: TextLikeControl,
  EMAIL: TextLikeControl,
  URL: TextLikeControl,
  IMAGE: ImageControl,
  FILE: FileControl,
  CONTACT_LINK: ContactLinkControl,
};

function PendingFieldNote({
  field,
  notEditableText,
}: {
  readonly field: PendingCustomField;
  readonly notEditableText: string;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-small font-semibold text-primary">{field.label}</p>
      <p className="text-small text-secondary">{notEditableText}</p>
    </div>
  );
}

export function CustomFieldInputs({
  fields,
  pendingFields = [],
  values,
  errors,
  onChange,
  idPrefix,
  disabled = false,
  currencySymbol,
  moneyFractionDigits = DEFAULT_MONEY_FRACTION_DIGITS,
  chooseLabel,
  notEditableText,
  files,
  contactLink,
}: CustomFieldInputsProps): ReactElement {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {fields.map((field) => (
        <FieldRow
          key={field.fieldKey}
          field={field}
          value={values[field.fieldKey]}
          error={errors[field.fieldKey]}
          onChange={onChange}
          inputId={`${idPrefix}-${field.fieldKey}`}
          disabled={disabled}
          currencySymbol={currencySymbol}
          moneyFractionDigits={moneyFractionDigits}
          chooseLabel={chooseLabel}
          files={files}
          contactLink={contactLink}
        />
      ))}
      {pendingFields.map((field) => (
        <PendingFieldNote key={field.fieldKey} field={field} notEditableText={notEditableText} />
      ))}
    </div>
  );
}
