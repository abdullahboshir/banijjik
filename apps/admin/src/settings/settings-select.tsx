"use client";

import { FormField, Select } from "@banijjik/ui";
import type { ReactElement } from "react";

export interface SettingsSelectProps {
  fieldId: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  /** A value that is fixed after it is first saved. */
  disabled?: boolean | undefined;
}

/** A labelled native select of a settings form (the best picker on a phone, 13-UX section 4.3). */
export function SettingsSelect(props: SettingsSelectProps): ReactElement {
  return (
    <FormField label={props.label} htmlFor={props.fieldId}>
      <Select
        id={props.fieldId}
        name={props.fieldId}
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
