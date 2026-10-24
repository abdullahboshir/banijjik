"use client";

import { FormField, Select, formFieldMessageId } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement, ReactNode } from "react";

export function ChoiceField(props: {
  id: string;
  label: string;
  value: string;
  errorKey: string | undefined;
  isRequired?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}): ReactElement {
  const { t } = useTranslator();
  const error = props.errorKey === undefined ? undefined : t(props.errorKey);
  return (
    <FormField label={props.label} htmlFor={props.id} error={error} required={props.isRequired}>
      <Select
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        disabled={props.disabled}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : formFieldMessageId(props.id, "error")}
      >
        {props.children}
      </Select>
    </FormField>
  );
}
export function Options(props: {
  placeholder: string;
  options: readonly { id: string; name: string }[];
}): ReactElement {
  return (
    <>
      <option value="">{props.placeholder}</option>
      {props.options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </>
  );
}
