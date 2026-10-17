import type { FileInputLabels } from "./file-input.js";
import type { ImageInputLabels } from "./image-input.js";

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
  "IMAGE",
  "FILE",
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

/**
 * What IMAGE and FILE inputs need from the app: the upload itself, its state, and where a saved
 * value can be shown. The package keeps no API knowledge (card 3.0).
 */
export interface CustomFieldFileSupport {
  readonly onPick: (fieldKey: string, file: File) => void;
  readonly onClear: (fieldKey: string) => void;
  readonly isUploading: (fieldKey: string) => boolean;
  /** The saved value of an image field as a picture address; undefined when none. */
  readonly previewUrlOf: (value: unknown) => string | undefined;
  /** The saved value of a file field as a link; undefined when none. */
  readonly hrefOf: (value: unknown) => string | undefined;
  readonly imageLabels: ImageInputLabels;
  readonly fileLabels: FileInputLabels;
  /** Previews of private images need the session cookie. */
  readonly sendsCredentials: boolean;
}

export interface PendingCustomField {
  readonly fieldKey: string;
  readonly label: string;
}

export interface CustomFieldInputsProps {
  /** Required when a descriptor has the IMAGE or FILE kind. */
  readonly files?: CustomFieldFileSupport | undefined;
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
