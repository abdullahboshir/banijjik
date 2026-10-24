"use client";

import {
  ContactLinkInput,
  FormField,
  Select,
  TextInput,
  type ContactLinkInputProps,
} from "@banijjik/ui";
import type { ReactElement } from "react";
import { usesFixedStartDates, type PlanChoice, type ResourceChoice } from "./new-enrollment-form";
import type { NewEnrollmentSheetLabels } from "./new-enrollment-labels";

export function PlanFields(props: {
  labels: NewEnrollmentSheetLabels;
  plans: readonly PlanChoice[];
  offeringId: string;
  variantId: string;
  selectedPlan: PlanChoice | undefined;
  onPlanChange: (offeringId: string) => void;
  onVariantChange: (variantId: string) => void;
}): ReactElement {
  const { labels } = props;
  return (
    <>
      <FormField label={labels.plan} htmlFor="new-enrollment-plan" required>
        <Select
          id="new-enrollment-plan"
          value={props.offeringId}
          onChange={(event) => props.onPlanChange(event.target.value)}
        >
          <option value="">{labels.choosePlan}</option>
          {props.plans.map((plan) => (
            <option key={plan.offeringId} value={plan.offeringId}>
              {plan.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={labels.variant} htmlFor="new-enrollment-variant" required>
        <Select
          id="new-enrollment-variant"
          value={props.variantId}
          onChange={(event) => props.onVariantChange(event.target.value)}
        >
          <option value="">{labels.chooseVariant}</option>
          {(props.selectedPlan?.variants ?? []).map((variant) => (
            <option key={variant.variantId} value={variant.variantId}>
              {variant.name}
            </option>
          ))}
        </Select>
      </FormField>
    </>
  );
}

export function StartDateField(props: {
  labels: NewEnrollmentSheetLabels;
  selectedPlan: PlanChoice | undefined;
  startsOn: string;
  error: string | undefined;
  onChange: (startsOn: string) => void;
}): ReactElement {
  const { labels } = props;
  if (usesFixedStartDates(props.selectedPlan)) {
    return (
      <FormField
        label={labels.startDate}
        htmlFor="new-enrollment-start"
        error={props.error}
        required
      >
        <Select
          id="new-enrollment-start"
          value={props.startsOn}
          onChange={(event) => props.onChange(event.target.value)}
        >
          <option value="">{labels.chooseDate}</option>
          {(props.selectedPlan?.startDates ?? []).map((date) => (
            <option key={date} value={date}>
              {date}
            </option>
          ))}
        </Select>
      </FormField>
    );
  }
  return (
    <FormField label={labels.startDate} htmlFor="new-enrollment-start" error={props.error} required>
      <TextInput
        id="new-enrollment-start"
        type="date"
        value={props.startsOn}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </FormField>
  );
}

export function ResourceField(props: {
  labels: NewEnrollmentSheetLabels;
  resources: readonly ResourceChoice[];
  resourceId: string;
  onChange: (resourceId: string) => void;
}): ReactElement | null {
  if (props.resources.length === 0) return null;
  return (
    <FormField label={props.labels.resource} htmlFor="new-enrollment-resource">
      <Select
        id="new-enrollment-resource"
        value={props.resourceId}
        onChange={(event) => props.onChange(event.target.value)}
      >
        <option value="">{props.labels.noResource}</option>
        {props.resources.map((resource) => (
          <option key={resource.resourceId} value={resource.resourceId}>
            {resource.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

export function LocationField(props: {
  labels: NewEnrollmentSheetLabels;
  locations: readonly { readonly locationId: string; readonly name: string }[];
  locationId: string;
  onChange: (locationId: string) => void;
}): ReactElement | null {
  if (props.locations.length < 2) return null;
  return (
    <FormField label={props.labels.location} htmlFor="new-enrollment-location" required>
      <Select
        id="new-enrollment-location"
        value={props.locationId}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.locations.map((location) => (
          <option key={location.locationId} value={location.locationId}>
            {location.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

export function ContactField(props: {
  value: unknown;
  error: string | undefined;
  contactLink: Pick<ContactLinkInputProps, "search" | "labels">;
  onChange: ContactLinkInputProps["onChange"];
}): ReactElement {
  return (
    <ContactLinkInput
      id="new-enrollment-contact"
      value={props.value}
      onChange={props.onChange}
      search={props.contactLink.search}
      labels={props.contactLink.labels}
      error={props.error}
      isRequired
    />
  );
}
