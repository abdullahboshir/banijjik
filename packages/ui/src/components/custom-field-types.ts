export const CUSTOM_FIELD_INPUT_KIND = [
  "TEXT",
  "LONG_TEXT",
  "INTEGER",
  "DECIMAL",
  "MONEY",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "SELECT",
  "MULTI_SELECT",
  "PHONE",
  "EMAIL",
  "URL",
] as const;

export type CustomFieldInputKind = (typeof CUSTOM_FIELD_INPUT_KIND)[number];

export interface CustomFieldOption {
  readonly value: string;
  readonly label: string;
}

/** Presentation only. Labels are already in the user's language; this package has no catalogs. */
export interface CustomFieldDescriptor {
  readonly fieldKey: string;
  readonly inputKind: CustomFieldInputKind;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly isRequired: boolean;
  readonly options?: readonly CustomFieldOption[] | undefined;
  readonly maxLength?: number | undefined;
}

export interface PendingCustomField {
  readonly fieldKey: string;
  readonly label: string;
}

export interface CustomFieldInputsProps {
  readonly fields: readonly CustomFieldDescriptor[];
  readonly pendingFields?: readonly PendingCustomField[] | undefined;
  readonly values: Readonly<Record<string, unknown>>;
  readonly errors: Readonly<Record<string, string | undefined>>;
  readonly onChange: (fieldKey: string, value: unknown) => void;
  readonly idPrefix: string;
  readonly disabled?: boolean | undefined;
  readonly currencySymbol: string;
  /** Fraction digits of the currency. Defaults to 2 (paisa). Parsing stays integer-only. */
  readonly moneyFractionDigits?: number | undefined;
  readonly chooseLabel: string;
  readonly notEditableText: string;
}
