"use client";

import type { AvailabilitySlot } from "@banijjik/contracts/booking";
import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { ReactElement } from "react";
import type { NewBookingFormState, NewBookingStep } from "./new-booking-form";
import {
  NewBookingConfirmStep,
  NewBookingContactStep,
  NewBookingServiceStep,
  NewBookingSlotStep,
  NewBookingVariantStep,
} from "./new-booking-sheet-fields";
import type { NewBookingSheetLabels } from "./new-booking-sheet";

export type NewBookingStepFieldInput = {
  step: NewBookingStep;
  labels: NewBookingSheetLabels;
  locale: string;
  timeZone: string;
  offerings: readonly OfferingResponse[];
  form: NewBookingFormState;
  slots: AvailabilitySlot[];
  slotsLoading: boolean;
  selectedOffering: OfferingResponse | undefined;
  contactLink: React.ComponentProps<typeof NewBookingContactStep>["contactLink"];
  contactError: string | undefined;
  onOfferingChange: (offeringId: string) => void;
  onVariantChange: (variantId: string) => void;
  onPickSlot: (slot: AvailabilitySlot) => void;
  onContactChange: React.ComponentProps<typeof NewBookingContactStep>["onContactChange"];
  onNoteChange: (note: string) => void;
};

const stepRenderers: Record<NewBookingStep, (input: NewBookingStepFieldInput) => ReactElement> = {
  service: (input) => (
    <NewBookingServiceStep
      labels={input.labels}
      offerings={input.offerings}
      offeringId={input.form.offeringId}
      onOfferingChange={input.onOfferingChange}
    />
  ),
  variant: (input) => (
    <NewBookingVariantStep
      labels={input.labels}
      variants={input.selectedOffering?.variants ?? []}
      variantId={input.form.variantId}
      onVariantChange={input.onVariantChange}
    />
  ),
  slot: (input) => (
    <NewBookingSlotStep
      labels={input.labels}
      locale={input.locale}
      timeZone={input.timeZone}
      slots={input.slots}
      slotsLoading={input.slotsLoading}
      startsAt={input.form.startsAt}
      onPickSlot={input.onPickSlot}
    />
  ),
  contact: (input) => (
    <NewBookingContactStep
      labels={input.labels}
      form={input.form}
      contactLink={input.contactLink}
      contactError={input.contactError}
      onContactChange={input.onContactChange}
      onNoteChange={input.onNoteChange}
    />
  ),
  confirm: (input) => (
    <NewBookingConfirmStep
      labels={input.labels}
      form={input.form}
      locale={input.locale}
      timeZone={input.timeZone}
      serviceName={input.selectedOffering?.name}
      slots={input.slots}
    />
  ),
};

export function newBookingStepField(input: NewBookingStepFieldInput): ReactElement | null {
  return stepRenderers[input.step](input);
}
