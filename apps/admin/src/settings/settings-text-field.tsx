"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { FormField, TextInput, formFieldMessageId } from "@banijjik/ui";
import type { ComponentProps, ReactElement } from "react";

export interface SettingsTextFieldProps {
  fieldId: string;
  label: string;
  value: string;
  /** Message key of the error on this field; translated here. */
  errorKey?: string | undefined;
  hint?: string | undefined;
  isRequired?: boolean | undefined;
  inputMode?: ComponentProps<"input">["inputMode"] | undefined;
  autoComplete?: ComponentProps<"input">["autoComplete"] | undefined;
  onChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
  /** A value that is fixed after it is first saved. */
  disabled?: boolean | undefined;
}

function describedBy(fieldId: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids = [
    hasHint ? formFieldMessageId(fieldId, "hint") : undefined,
    hasError ? formFieldMessageId(fieldId, "error") : undefined,
  ].filter((id) => id !== undefined);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/** A labelled text input of a settings form: the error and the hint are announced with the input. */
export function SettingsTextField(props: SettingsTextFieldProps): ReactElement {
  const { t } = useTranslator();
  const { fieldId, errorKey, hint } = props;
  const error = errorKey ? t(errorKey) : undefined;
  return (
    <FormField
      label={props.label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      required={props.isRequired}
    >
      <TextInput
        id={fieldId}
        name={fieldId}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onBlur}
        disabled={props.disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, Boolean(hint), Boolean(error))}
      />
    </FormField>
  );
}
