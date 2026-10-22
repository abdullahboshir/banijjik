"use client";

import { Checkbox, FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { EditorLabels } from "./catalog-labels";
import type { OfferingFormState } from "./offering-form";

/** What every section of the editor gets: the state, how to change it, the texts and the translated errors. */
export interface SectionProps {
  form: OfferingFormState;
  update: (patch: Partial<OfferingFormState>) => void;
  labels: EditorLabels;
  /** Translated message per field name. */
  errors: Readonly<Record<string, string | undefined>>;
  isReadOnly: boolean;
}

export interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  inputMode?: "decimal" | "numeric" | "text" | undefined;
  disabled?: boolean | undefined;
}

/** A labelled one-line input; numbers use the numeric keyboard of a phone. */
export function TextField(props: TextFieldProps): ReactElement {
  return (
    <FormField label={props.label} htmlFor={props.id} error={props.error} hint={props.hint}>
      <TextInput
        id={props.id}
        name={props.id}
        value={props.value}
        inputMode={props.inputMode}
        disabled={props.disabled}
        aria-invalid={props.error ? true : undefined}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </FormField>
  );
}

export interface ChoiceFieldProps {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
}

export function ChoiceField(props: ChoiceFieldProps): ReactElement {
  return (
    <FormField label={props.label} htmlFor={props.id}>
      <Select
        id={props.id}
        name={props.id}
        value={props.value}
        disabled={props.disabled}
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

export function ToggleField(props: {
  id?: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean | undefined;
}): ReactElement {
  return (
    <Checkbox
      id={props.id}
      label={props.label}
      checked={props.checked}
      disabled={props.disabled}
      onChange={(event) => props.onChange(event.target.checked)}
    />
  );
}
