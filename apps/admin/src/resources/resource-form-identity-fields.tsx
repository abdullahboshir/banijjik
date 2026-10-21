"use client";

import { FormField, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { ResourceFormState } from "./resource-form";

export function ResourceFormIdentityFields(props: {
  form: ResourceFormState;
  resourceTypes?: readonly { value: string; label: string }[] | undefined;
  resourceTypeLabel?: string | undefined;
  nameLabel: string;
  capacityLabel: string;
  onFormChange: (update: (current: ResourceFormState) => ResourceFormState) => void;
}): ReactElement {
  return (
    <>
      {props.resourceTypes !== undefined && props.resourceTypeLabel !== undefined ? (
        <FormField label={props.resourceTypeLabel} htmlFor="resource-type" required>
          <select
            id="resource-type"
            value={props.form.resourceTypeKey}
            className="min-h-11 rounded-md border border-default bg-surface px-3 text-body text-primary"
            onChange={(event) =>
              props.onFormChange((current) => ({ ...current, resourceTypeKey: event.target.value }))
            }
          >
            {props.resourceTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </FormField>
      ) : null}
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
