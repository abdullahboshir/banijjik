"use client";

import { OFFERING_KIND, type OfferingKind } from "@banijjik/contracts";
import {
  BILLING_PERIOD_UNIT,
  BOOKING_MODE,
  PLAN_START_RULE,
  RENTAL_RATE_UNIT,
  type BillingPeriodUnit,
  type BookingMode,
  type PlanStartRule,
} from "@banijjik/contracts/catalog";
import { FormField, PageSection, Textarea } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { EditorLabels } from "./catalog-labels";
import { ChoiceField, TextField, ToggleField, type SectionProps } from "./editor-fields";
import type { DetailsState } from "./offering-form";

interface DetailsProps extends SectionProps {
  currencySymbol: string;
  /** The resource choices of the business's template, labelled with its own words. */
  resourceTypes: readonly { value: string; label: string }[];
}

interface PartProps extends DetailsProps {
  change: (patch: Partial<DetailsState>) => void;
}

function optionsOf(
  labels: EditorLabels,
  prefix: string,
  keys: readonly string[],
): { value: string; label: string }[] {
  // Safe: a label exists for every key of the enums listed in the editor label list.
  return keys.map((value) => ({
    value,
    label: labels[`${prefix}.${value}` as keyof EditorLabels],
  }));
}

function NumberField(
  props: PartProps & { field: keyof DetailsState; labelKey: keyof EditorLabels },
) {
  const { form, labels, errors, isReadOnly, change, field, labelKey } = props;
  return (
    <TextField
      id={`detail-${field}`}
      label={labels[labelKey]}
      value={String(form.details[field])}
      inputMode="numeric"
      error={errors[field]}
      disabled={isReadOnly}
      onChange={(value) => change({ [field]: value })}
    />
  );
}

function ProductDetails(props: PartProps): ReactElement {
  const { form, labels, isReadOnly, change } = props;
  return (
    <>
      <ToggleField
        label={labels["details.requiresShipping"]}
        checked={form.details.requiresShipping}
        disabled={isReadOnly}
        onChange={(requiresShipping) => change({ requiresShipping })}
      />
      <NumberField {...props} field="weightGrams" labelKey="details.weightGrams" />
    </>
  );
}

function ResourceTypePicker(props: PartProps): ReactElement | null {
  const { form, labels, isReadOnly, resourceTypes, change } = props;
  if (resourceTypes.length === 0) return null;
  const selected = form.details.resourceTypeKeys;
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-small font-semibold text-primary">
        {labels["details.resourceTypes"]}
      </legend>
      {resourceTypes.map((type) => (
        <ToggleField
          key={type.value}
          label={type.label}
          checked={selected.includes(type.value)}
          disabled={isReadOnly}
          onChange={(isOn) =>
            change({
              resourceTypeKeys: isOn
                ? [...selected, type.value]
                : selected.filter((key) => key !== type.value),
            })
          }
        />
      ))}
    </fieldset>
  );
}

function ServiceDetails(props: PartProps): ReactElement {
  const { form, labels, isReadOnly, change } = props;
  return (
    <>
      <NumberField {...props} field="durationMinutes" labelKey="details.durationMinutes" />
      <NumberField {...props} field="bufferAfterMinutes" labelKey="details.bufferAfterMinutes" />
      <ToggleField
        id="detail-requires-resource"
        label={labels["details.requiresResource"]}
        checked={form.details.requiresResource}
        disabled={isReadOnly}
        onChange={(requiresResource) => change({ requiresResource })}
      />
      {form.details.requiresResource ? <ResourceTypePicker {...props} /> : null}
      <ChoiceField
        id="detail-booking-mode"
        label={labels["details.bookingMode"]}
        value={form.details.bookingMode}
        disabled={isReadOnly}
        options={optionsOf(labels, "details.bookingMode", Object.values(BOOKING_MODE))}
        onChange={(value) => change({ bookingMode: value as BookingMode })}
      />
    </>
  );
}

function PlanPeriod(props: PartProps): ReactElement {
  const { form, labels, isReadOnly, change } = props;
  return (
    <>
      <NumberField {...props} field="billingCount" labelKey="details.billingCount" />
      <ChoiceField
        id="detail-billing-unit"
        label={labels["details.billingUnit"]}
        value={form.details.billingUnit}
        disabled={isReadOnly}
        options={optionsOf(labels, "details.billingUnit", Object.values(BILLING_PERIOD_UNIT))}
        onChange={(value) => change({ billingUnit: value as BillingPeriodUnit })}
      />
      <TextField
        id="detail-admissionFee"
        label={`${labels["details.admissionFee"]} (${props.currencySymbol})`}
        value={form.details.admissionFee}
        inputMode="decimal"
        error={props.errors["admissionFee"]}
        disabled={isReadOnly}
        onChange={(admissionFee) => change({ admissionFee })}
      />
    </>
  );
}

function PlanStart(props: PartProps): ReactElement {
  const { form, labels, errors, isReadOnly, change } = props;
  return (
    <>
      <ChoiceField
        id="detail-start-rule"
        label={labels["details.startRule"]}
        value={form.details.startRule}
        disabled={isReadOnly}
        options={optionsOf(labels, "details.startRule", Object.values(PLAN_START_RULE))}
        onChange={(value) => change({ startRule: value as PlanStartRule })}
      />
      {form.details.startRule === PLAN_START_RULE.FIXED_DATES ? (
        <FormField
          label={labels["details.startDates"]}
          htmlFor="detail-start-dates"
          hint={labels["details.startDatesHint"]}
          error={errors["startDates"]}
        >
          <Textarea
            id="detail-start-dates"
            value={form.details.startDates}
            disabled={isReadOnly}
            onChange={(event) => change({ startDates: event.target.value })}
          />
        </FormField>
      ) : null}
    </>
  );
}

function PlanDetails(props: PartProps): ReactElement {
  return (
    <>
      <PlanPeriod {...props} />
      <NumberField {...props} field="capacity" labelKey="details.capacity" />
      <NumberField {...props} field="sessionLimitPerPeriod" labelKey="details.sessionLimit" />
      <PlanStart {...props} />
    </>
  );
}

function RentalDetails(props: PartProps): ReactElement {
  const { form, labels, isReadOnly, change } = props;
  return (
    <>
      <ChoiceField
        id="detail-rate-unit"
        label={labels["details.rateUnit"]}
        value={form.details.rateUnit}
        disabled={isReadOnly}
        options={optionsOf(labels, "details.rateUnit", Object.values(RENTAL_RATE_UNIT))}
        onChange={(value) => change({ rateUnit: value as never })}
      />
      <NumberField {...props} field="minUnits" labelKey="details.minUnits" />
      <NumberField {...props} field="maxUnits" labelKey="details.maxUnits" />
      {form.details.rateUnit === "NIGHT" ? (
        <>
          <TextField
            id="detail-check-in"
            label={labels["details.checkInTime"]}
            value={form.details.checkInTime}
            disabled={isReadOnly}
            onChange={(checkInTime) => change({ checkInTime })}
          />
          <TextField
            id="detail-check-out"
            label={labels["details.checkOutTime"]}
            value={form.details.checkOutTime}
            disabled={isReadOnly}
            onChange={(checkOutTime) => change({ checkOutTime })}
          />
        </>
      ) : null}
      <TextField
        id="detail-deposit-amount"
        label={labels["details.depositAmount"]}
        value={form.details.depositAmount}
        inputMode="decimal"
        disabled={isReadOnly}
        onChange={(depositAmount) => change({ depositAmount })}
      />
    </>
  );
}

function EventDetails(props: PartProps): ReactElement {
  const { form, labels, isReadOnly, change } = props;
  return (
    <>
      <NumberField
        {...props}
        field="salesCloseMinutesBefore"
        labelKey="details.salesCloseMinutesBefore"
      />
      <ToggleField
        label={labels["details.allowWaitlist"]}
        checked={form.details.allowWaitlist}
        disabled={isReadOnly}
        onChange={(allowWaitlist) => change({ allowWaitlist })}
      />
    </>
  );
}

const PARTS: Partial<Record<OfferingKind, (props: PartProps) => ReactElement>> = {
  [OFFERING_KIND.PRODUCT]: ProductDetails,
  [OFFERING_KIND.SERVICE]: ServiceDetails,
  [OFFERING_KIND.PLAN]: PlanDetails,
  [OFFERING_KIND.RENTAL]: RentalDetails,
  [OFFERING_KIND.EVENT]: EventDetails,
};

export function hasKindDetails(kind: OfferingKind): boolean {
  return PARTS[kind] !== undefined;
}

/** Only the fields of the offering kind (plan 3.2b, section 4 of the editor). */
export function EditorDetails(props: DetailsProps): ReactElement | null {
  const { form, labels, update } = props;
  const Part = PARTS[form.kind];
  if (!Part) return null;
  return (
    <PageSection title={labels["section.details.title"]} help={labels["section.details.help"]}>
      <Part {...props} change={(patch) => update({ details: { ...form.details, ...patch } })} />
    </PageSection>
  );
}
