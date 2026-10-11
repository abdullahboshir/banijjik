"use client";

import { FormField, Textarea } from "@banijjik/ui";
import type { ReactElement } from "react";
import { useTranslator } from "../i18n/i18n-provider";

export interface ReasonFieldProps {
  fieldId: string;
  label: string;
  hint?: string;
  value: string;
  /** A message key from the catalog, or undefined. */
  errorKey: string | undefined;
  onChange: (value: string) => void;
}

/** The mandatory reason of an operator action; it goes to the platform audit log. */
export function ReasonField(props: ReasonFieldProps): ReactElement {
  const { t } = useTranslator();
  return (
    <FormField
      label={props.label}
      htmlFor={props.fieldId}
      hint={props.hint}
      error={props.errorKey ? t(props.errorKey) : undefined}
      required
    >
      <Textarea
        id={props.fieldId}
        name="reason"
        value={props.value}
        aria-invalid={props.errorKey ? true : undefined}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </FormField>
  );
}
