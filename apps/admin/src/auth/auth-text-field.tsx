"use client";

import { FormField, TextInput, formFieldMessageId } from "@banijjik/ui";
import type { ComponentProps, ReactElement } from "react";

export interface AuthTextFieldProps {
  fieldId: string;
  label: string;
  hint?: string;
  value: string;
  error: string | undefined;
  autoComplete: ComponentProps<"input">["autoComplete"];
  /** Identifiers are typed exactly as they are: no capital letters, no autocorrect. */
  isIdentifier?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function describedBy(props: AuthTextFieldProps): string | undefined {
  const ids = [
    props.hint ? formFieldMessageId(props.fieldId, "hint") : undefined,
    props.error ? formFieldMessageId(props.fieldId, "error") : undefined,
  ].filter((id) => id !== undefined);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/** A labelled text input wired to the form hook: error and hint are announced with the input. */
export function AuthTextField(props: AuthTextFieldProps): ReactElement {
  return (
    <FormField
      label={props.label}
      htmlFor={props.fieldId}
      hint={props.hint}
      error={props.error}
      required
    >
      <TextInput
        id={props.fieldId}
        name={props.fieldId}
        autoComplete={props.autoComplete}
        autoCapitalize={props.isIdentifier ? "none" : undefined}
        autoCorrect={props.isIdentifier ? "off" : undefined}
        spellCheck={props.isIdentifier ? false : undefined}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onBlur}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(props)}
      />
    </FormField>
  );
}
