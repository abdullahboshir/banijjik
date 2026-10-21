"use client";

import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { ResourceTimeOffResponse } from "@banijjik/contracts/booking";
import type { ReactElement } from "react";
import type { ResourceFormState } from "./resource-form";
import { ResourceFormIdentityFields } from "./resource-form-identity-fields";
import { ResourceFormOfferingsField } from "./resource-form-offerings-field";
import { ResourceFormTimeOffFields } from "./resource-form-time-off-fields";
import { ResourceScheduleEditor } from "./resource-schedule-editor";

export function ResourceFormSheetBody(props: {
  form: ResourceFormState;
  resourceTypes: readonly { value: string; label: string }[] | undefined;
  resourceTypeLabel: string | undefined;
  offerings: readonly OfferingResponse[];
  isEdit: boolean;
  timeOff: readonly ResourceTimeOffResponse[] | undefined;
  labels: {
    name: string;
    capacity: string;
    offerings: string;
    opens: string;
    closes: string;
    copyWeek: string;
    timeOff: string;
    timeOffStart: string;
    timeOffEnd: string;
  };
  weekdayLabel: (weekday: number) => string;
  onFormChange: (update: (current: ResourceFormState) => ResourceFormState) => void;
}): ReactElement {
  return (
    <>
      <ResourceFormIdentityFields
        resourceTypes={props.isEdit ? undefined : props.resourceTypes}
        resourceTypeLabel={props.resourceTypeLabel}
        form={props.form}
        nameLabel={props.labels.name}
        capacityLabel={props.labels.capacity}
        onFormChange={props.onFormChange}
      />
      <ResourceFormOfferingsField
        offerings={props.offerings}
        form={props.form}
        label={props.labels.offerings}
        onFormChange={props.onFormChange}
      />
      <ResourceScheduleEditor
        rows={props.form.scheduleRows}
        weekdayLabel={props.weekdayLabel}
        opensLabel={props.labels.opens}
        closesLabel={props.labels.closes}
        copyWeekLabel={props.labels.copyWeek}
        onChange={(scheduleRows) => props.onFormChange((current) => ({ ...current, scheduleRows }))}
      />
      {props.isEdit ? (
        <ResourceFormTimeOffFields
          form={props.form}
          timeOff={props.timeOff}
          labels={{
            timeOff: props.labels.timeOff,
            timeOffStart: props.labels.timeOffStart,
            timeOffEnd: props.labels.timeOffEnd,
          }}
          onFormChange={props.onFormChange}
        />
      ) : null}
    </>
  );
}
