"use client";

import type { ResourceTimeOffResponse } from "@banijjik/contracts/booking";
import { FormField, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { ResourceFormState } from "./resource-form";

export function ResourceFormTimeOffFields(props: {
  form: ResourceFormState;
  timeOff: readonly ResourceTimeOffResponse[] | undefined;
  labels: {
    timeOff: string;
    timeOffStart: string;
    timeOffEnd: string;
  };
  onFormChange: (update: (current: ResourceFormState) => ResourceFormState) => void;
}): ReactElement {
  return (
    <>
      <h3 className="text-body font-semibold text-primary">{props.labels.timeOff}</h3>
      {(props.timeOff ?? []).map((row) => (
        <p key={row.resourceTimeOffId} className="text-small text-secondary">
          {row.startsAt} – {row.endsAt}
        </p>
      ))}
      <FormField label={props.labels.timeOffStart} htmlFor="resource-time-off-start">
        <TextInput
          id="resource-time-off-start"
          type="datetime-local"
          value={props.form.timeOffStartsAt}
          onChange={(event) =>
            props.onFormChange((current) => ({
              ...current,
              timeOffStartsAt: event.target.value,
            }))
          }
        />
      </FormField>
      <FormField label={props.labels.timeOffEnd} htmlFor="resource-time-off-end">
        <TextInput
          id="resource-time-off-end"
          type="datetime-local"
          value={props.form.timeOffEndsAt}
          onChange={(event) =>
            props.onFormChange((current) => ({
              ...current,
              timeOffEndsAt: event.target.value,
            }))
          }
        />
      </FormField>
    </>
  );
}
