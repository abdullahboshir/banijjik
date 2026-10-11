"use client";

import { FormField, TextInput } from "@banijjik/ui";
import type { ComponentProps, ReactElement } from "react";
import { useTranslator } from "../i18n/i18n-provider";

export interface TextFieldRowProps {
  fieldId: string;
  label: string;
  value: string;
  /** A message key from the catalog, or undefined. */
  errorKey: string | undefined;
  hint?: string | undefined;
  type?: ComponentProps<"input">["type"];
  autoComplete?: ComponentProps<"input">["autoComplete"];
  readOnly?: boolean;
  isRequired?: boolean;
  onChange: (value: string) => void;
}

/** A labelled text input whose error is a message key: the error is announced together with the input. */
export function TextFieldRow(props: TextFieldRowProps): ReactElement {
  const { t } = useTranslator();
  return (
    <FormField
      label={props.label}
      htmlFor={props.fieldId}
      hint={props.hint}
      error={props.errorKey ? t(props.errorKey) : undefined}
      required={props.isRequired ?? true}
    >
      <TextInput
        id={props.fieldId}
        name={props.fieldId}
        type={props.type}
        autoComplete={props.autoComplete}
        readOnly={props.readOnly}
        value={props.value}
        aria-invalid={props.errorKey ? true : undefined}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </FormField>
  );
}
