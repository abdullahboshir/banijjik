"use client";

import type { AvailabilitySlot } from "@banijjik/contracts/booking";
import type { OfferingResponse } from "@banijjik/contracts/catalog";
import { ContactLinkInput, FormField, Textarea, type ContactLinkInputProps } from "@banijjik/ui";
import type { ReactElement } from "react";
import { formatLocalTimeRange } from "./booking-local-time";
import type { NewBookingFormState } from "./new-booking-form";
import type { NewBookingSheetLabels } from "./new-booking-sheet";

export function NewBookingServiceStep(props: {
  labels: NewBookingSheetLabels;
  offerings: readonly OfferingResponse[];
  offeringId: string;
  onOfferingChange: (offeringId: string) => void;
}): ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-small text-secondary">{props.labels.service}</span>
      <select
        id="new-booking-service"
        className="min-h-11 rounded-md border border-default bg-surface px-3 text-body"
        value={props.offeringId}
        onChange={(event) => props.onOfferingChange(event.target.value)}
      >
        <option value="">{props.labels.chooseService}</option>
        {props.offerings.map((offering) => (
          <option key={offering.offeringId} value={offering.offeringId}>
            {offering.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NewBookingVariantStep(props: {
  labels: NewBookingSheetLabels;
  variants: OfferingResponse["variants"];
  variantId: string;
  onVariantChange: (variantId: string) => void;
}): ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-small text-secondary">{props.labels.variant}</span>
      <select
        id="new-booking-variant"
        className="min-h-11 rounded-md border border-default bg-surface px-3 text-body"
        value={props.variantId}
        onChange={(event) => props.onVariantChange(event.target.value)}
      >
        <option value="">{props.labels.chooseVariant}</option>
        {props.variants.map((variant) => (
          <option key={variant.variantId} value={variant.variantId}>
            {variant.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NewBookingSlotStep(props: {
  labels: NewBookingSheetLabels;
  locale: string;
  timeZone: string;
  slots: AvailabilitySlot[];
  slotsLoading: boolean;
  startsAt: string;
  onPickSlot: (slot: AvailabilitySlot) => void;
}): ReactElement {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-small text-secondary">{props.labels.slot}</legend>
      {props.slotsLoading ? (
        <p className="text-small text-secondary">{props.labels.loadingSlots}</p>
      ) : null}
      {!props.slotsLoading && props.slots.length === 0 ? (
        <p className="text-small text-secondary">{props.labels.noSlots}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {props.slots.map((slot) => (
          <li key={slot.startsAt}>
            <button
              type="button"
              className={`min-h-11 w-full rounded-md border px-3 text-start text-body ${
                props.startsAt === slot.startsAt
                  ? "border-accent bg-accent-subtle"
                  : "border-default bg-surface"
              }`}
              onClick={() => props.onPickSlot(slot)}
            >
              {formatLocalTimeRange({
                startsAt: slot.startsAt,
                endsAt: slot.endsAt,
                locale: props.locale,
                timeZone: props.timeZone,
              })}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

export function NewBookingContactStep(props: {
  labels: NewBookingSheetLabels;
  form: NewBookingFormState;
  contactError: string | undefined;
  contactLink: Pick<ContactLinkInputProps, "search" | "labels">;
  onContactChange: ContactLinkInputProps["onChange"];
  onNoteChange: (note: string) => void;
}): ReactElement {
  return (
    <>
      <ContactLinkInput
        id="new-booking-contact"
        value={props.form.contact}
        onChange={props.onContactChange}
        search={props.contactLink.search}
        labels={props.contactLink.labels}
        error={props.contactError}
        isRequired
      />
      <FormField label={props.labels.note} htmlFor="new-booking-note">
        <Textarea
          id="new-booking-note"
          value={props.form.note}
          onChange={(event) => props.onNoteChange(event.target.value)}
        />
      </FormField>
    </>
  );
}

export function NewBookingConfirmStep(props: {
  labels: NewBookingSheetLabels;
  form: NewBookingFormState;
  locale: string;
  timeZone: string;
  serviceName: string | undefined;
  slots: AvailabilitySlot[];
}): ReactElement {
  const endsAt =
    props.slots.find((slot) => slot.startsAt === props.form.startsAt)?.endsAt ??
    props.form.startsAt;
  return (
    <dl className="flex flex-col gap-2 text-body">
      <div>
        <dt className="text-small text-secondary">{props.labels.service}</dt>
        <dd>{props.serviceName ?? props.form.offeringId}</dd>
      </div>
      <div>
        <dt className="text-small text-secondary">{props.labels.slot}</dt>
        <dd>
          {props.form.startsAt === ""
            ? props.labels.notSet
            : formatLocalTimeRange({
                startsAt: props.form.startsAt,
                endsAt,
                locale: props.locale,
                timeZone: props.timeZone,
              })}
        </dd>
      </div>
    </dl>
  );
}
