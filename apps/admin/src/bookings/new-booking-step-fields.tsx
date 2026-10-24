"use client";

import type { AvailabilitySlot } from "@banijjik/contracts/booking";
import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { ReactElement } from "react";
import type { EventSessionView } from "./event-session-api";
import type { NewBookingFormState, NewBookingStep } from "./new-booking-form";
import {
  NewBookingEventStep,
  NewBookingModeSummary,
  NewBookingRentalStep,
} from "./new-booking-mode-fields";
import type { NewBookingModeData } from "./new-booking-mode";
import {
  NewBookingConfirmStep,
  NewBookingContactStep,
  NewBookingServiceStep,
  NewBookingSlotStep,
  NewBookingVariantStep,
} from "./new-booking-sheet-fields";
import type { NewBookingSheetLabels } from "./new-booking-sheet";
import { rentalEndPreview } from "./rental-end-preview";

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
  modeData: NewBookingModeData;
  contactLink: React.ComponentProps<typeof NewBookingContactStep>["contactLink"];
  contactError: string | undefined;
  onOfferingChange: (offeringId: string) => void;
  onVariantChange: (variantId: string) => void;
  onPickSlot: (slot: AvailabilitySlot) => void;
  onPickSession: (session: EventSessionView) => void;
  onRentalStartChange: (startsAt: string) => void;
  onResourceChange: (resourceId: string) => void;
  onContactChange: React.ComponentProps<typeof NewBookingContactStep>["onContactChange"];
  onNoteChange: (note: string) => void;
  onQuantityChange: (quantity: string) => void;
};

function SlotStepFor(input: NewBookingStepFieldInput): ReactElement {
  const { modeData, form } = input;
  if (modeData.mode === "RENTAL" && modeData.rental !== undefined) {
    return (
      <NewBookingRentalStep
        rental={modeData.rental}
        timeZone={input.timeZone}
        locale={input.locale}
        startsAt={form.startsAt}
        quantity={form.quantity}
        resourceId={form.resourceId}
        resources={modeData.rentalResources}
        total={modeData.total}
        quoteLoading={modeData.quoteLoading}
        onStartChange={input.onRentalStartChange}
        onQuantityChange={input.onQuantityChange}
        onResourceChange={input.onResourceChange}
      />
    );
  }
  if (modeData.mode === "EVENT") {
    return (
      <NewBookingEventStep
        sessions={modeData.sessions}
        sessionsLoading={modeData.sessionsLoading}
        eventSessionId={form.eventSessionId}
        quantity={form.quantity}
        timeZone={input.timeZone}
        locale={input.locale}
        total={modeData.total}
        quoteLoading={modeData.quoteLoading}
        onPickSession={input.onPickSession}
        onQuantityChange={input.onQuantityChange}
      />
    );
  }
  return (
    <NewBookingSlotStep
      labels={input.labels}
      locale={input.locale}
      timeZone={input.timeZone}
      slots={input.slots}
      slotsLoading={input.slotsLoading}
      startsAt={form.startsAt}
      onPickSlot={input.onPickSlot}
    />
  );
}

function selectedSessionOf(input: NewBookingStepFieldInput): EventSessionView | undefined {
  return input.modeData.sessions.find(
    (session) => session.eventSessionId === input.form.eventSessionId,
  );
}

function modeEndsAt(input: NewBookingStepFieldInput): string | undefined {
  const { modeData, form } = input;
  if (modeData.mode === "EVENT") return selectedSessionOf(input)?.endsAt;
  if (modeData.rental === undefined) return undefined;
  return rentalEndPreview({
    startsAt: form.startsAt,
    quantity: Number(form.quantity),
    rental: modeData.rental,
    timeZone: input.timeZone,
  })?.endsAt;
}

function ConfirmStepFor(input: NewBookingStepFieldInput): ReactElement {
  const { modeData, form } = input;
  const endsAt = modeEndsAt(input);
  return (
    <NewBookingConfirmStep
      labels={input.labels}
      form={form}
      locale={input.locale}
      timeZone={input.timeZone}
      serviceName={input.selectedOffering?.name}
      slots={input.slots}
      {...(endsAt === undefined ? {} : { endsAt })}
      extra={
        <NewBookingModeSummary
          mode={modeData.mode}
          rental={modeData.rental}
          quantity={form.quantity}
          startsAt={form.startsAt}
          timeZone={input.timeZone}
          total={modeData.total}
        />
      }
    />
  );
}

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
  slot: SlotStepFor,
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
  confirm: ConfirmStepFor,
};

export function newBookingStepField(input: NewBookingStepFieldInput): ReactElement | null {
  return stepRenderers[input.step](input);
}
