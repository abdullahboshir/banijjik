"use client";

import type { ContactRole } from "@banijjik/contracts";
import { FormField } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import type { RoleOption } from "./contact-labels";

const CHIP_CLASS =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-small transition-colors";

export interface RoleChipsProps {
  label: string;
  options: readonly RoleOption[];
  chosen: readonly ContactRole[];
  /** Message key of the error on the roles, translated here. */
  errorKey?: string | undefined;
  onChange: (roles: ContactRole[]) => void;
}

/** The roles a contact can have, as chips that can be switched on and off; the template's list decides which appear (ADR-113). */
export function RoleChips(props: RoleChipsProps): ReactElement {
  const { t } = useTranslator();
  function toggle(role: ContactRole): void {
    props.onChange(
      props.chosen.includes(role)
        ? props.chosen.filter((item) => item !== role)
        : [...props.chosen, role],
    );
  }
  return (
    <FormField
      label={props.label}
      htmlFor="contact-roles"
      error={props.errorKey ? t(props.errorKey) : undefined}
      required
    >
      <div
        id="contact-roles"
        role="group"
        aria-label={props.label}
        className="flex flex-wrap gap-2"
      >
        {props.options.map((option) => {
          const isOn = props.chosen.includes(option.role);
          return (
            <button
              key={option.role}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggle(option.role)}
              className={`${CHIP_CLASS} ${isOn ? "border-brand bg-brand text-on-brand" : "border-default bg-subtle text-primary"}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </FormField>
  );
}
