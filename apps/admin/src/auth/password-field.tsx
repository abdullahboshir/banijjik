"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { Button, FormField, TextInput, formFieldMessageId } from "@banijjik/ui";
import { useState, type ReactElement } from "react";

export interface PasswordFieldProps {
  fieldId: string;
  label: string;
  value: string;
  error: string | undefined;
  autoComplete: "current-password" | "new-password";
  onChange: (value: string) => void;
  onBlur: () => void;
}

/** A password input with a show/hide toggle; the toggle is a real button with an accessible name. */
export function PasswordField(props: PasswordFieldProps): ReactElement {
  const { t } = useTranslator();
  const [isVisible, setIsVisible] = useState(false);
  return (
    <FormField label={props.label} htmlFor={props.fieldId} error={props.error} required>
      <div className="flex gap-2">
        <TextInput
          id={props.fieldId}
          name={props.fieldId}
          type={isVisible ? "text" : "password"}
          autoComplete={props.autoComplete}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          onBlur={props.onBlur}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={props.error ? formFieldMessageId(props.fieldId, "error") : undefined}
          className="min-w-0 flex-1"
        />
        <Button
          variant="secondary"
          aria-pressed={isVisible}
          onClick={() => setIsVisible((previous) => !previous)}
        >
          {isVisible ? t("auth.password.hide") : t("auth.password.show")}
        </Button>
      </div>
    </FormField>
  );
}
