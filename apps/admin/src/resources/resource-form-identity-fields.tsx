"use client";

import { FormField, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { ResourceFormState } from "./resource-form";

export function ResourceFormIdentityFields(props: {
  form: ResourceFormState;
  nameLabel: string;
  capacityLabel: string;
  onFormChange: (update: (current: ResourceFormState) => ResourceFormState) => void;
}): ReactElement {
  return (
    <>
      <FormField label={props.nameLabel} htmlFor="resource-name" required>
        <TextInput
          id="resource-name"
          value={props.form.name}
          onChange={(event) =>
            props.onFormChange((current) => ({ ...current, name: event.target.value }))
          }
        />
      </FormField>
      <FormField label={props.capacityLabel} htmlFor="resource-capacity">
        <TextInput
          id="resource-capacity"
          inputMode="numeric"
          value={props.form.capacity}
          onChange={(event) =>
            props.onFormChange((current) => ({ ...current, capacity: event.target.value }))
          }
        />
      </FormField>
    </>
  );
}
