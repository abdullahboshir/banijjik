"use client";

import type { OfferingResponse } from "@banijjik/contracts/catalog";
import { Button, Sheet, SheetContent } from "@banijjik/ui";
import type { FormEvent, ReactElement } from "react";
import { SheetFeedback } from "../settings/sheet-feedback";
import type { useSheetSubmit } from "../settings/use-sheet-submit";
import {
  canAdvanceFrom,
  NEW_BOOKING_STEPS,
  stepIndexOf,
  type NewBookingFormState,
  type NewBookingStep,
} from "./new-booking-form";
import { newBookingFormHandlers } from "./new-booking-form-handlers";
import { newBookingStepField } from "./new-booking-step-fields";
import type { NewBookingSheetLabels } from "./new-booking-sheet";
import type { NewBookingModeData } from "./new-booking-mode";
import type { useNewBookingSlots } from "./use-new-booking-slots";

function StepNav(props: {
  step: NewBookingStep;
  labels: NewBookingSheetLabels;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
  isSaving: boolean;
}): ReactElement {
  const index = stepIndexOf(props.step);
  const isFirst = index === 0;
  const isLast = props.step === "confirm";
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {!isFirst ? (
        <Button type="button" variant="secondary" onClick={props.onBack}>
          {props.labels.back}
        </Button>
      ) : null}
      {!isLast ? (
        <Button type="button" onClick={props.onNext} disabled={!props.canNext}>
          {props.labels.next}
        </Button>
      ) : (
        <Button type="submit" isLoading={props.isSaving}>
          {props.labels.confirm}
        </Button>
      )}
    </div>
  );
}

export interface NewBookingSheetFormProps {
  labels: NewBookingSheetLabels;
  locale: string;
  timeZone: string;
  offerings: readonly OfferingResponse[];
  step: NewBookingStep;
  setStep: (step: NewBookingStep) => void;
  form: NewBookingFormState;
  setForm: React.Dispatch<React.SetStateAction<NewBookingFormState>>;
  slots: ReturnType<typeof useNewBookingSlots>["slots"];
  slotsLoading: boolean;
  selectedOffering: OfferingResponse | undefined;
  modeData: NewBookingModeData;
  contactLink: React.ComponentProps<
    typeof import("./new-booking-sheet-fields").NewBookingContactStep
  >["contactLink"];
  contactError: string | undefined;
  state: ReturnType<typeof useSheetSubmit>;
  onClose: () => void;
}

function NewBookingSheetFormInner(props: NewBookingSheetFormProps): ReactElement {
  const handlers = newBookingFormHandlers(props.setForm, props.offerings);
  const { labels, step, setStep, form } = props;
  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (step === "confirm") void props.state.submit();
        else if (canAdvanceFrom(step, form)) {
          const next = NEW_BOOKING_STEPS[stepIndexOf(step) + 1];
          if (next !== undefined) setStep(next);
        }
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      {newBookingStepField({
        step,
        labels,
        locale: props.locale,
        timeZone: props.timeZone,
        offerings: props.offerings,
        form,
        slots: props.slots,
        slotsLoading: props.slotsLoading,
        selectedOffering: props.selectedOffering,
        modeData: props.modeData,
        contactLink: props.contactLink,
        contactError: props.contactError,
        ...handlers,
      })}
      <SheetFeedback state={props.state} conflict={labels.conflict} reload={labels.reload} />
      <StepNav
        step={step}
        labels={labels}
        onBack={() => {
          const previous = NEW_BOOKING_STEPS[stepIndexOf(step) - 1];
          if (previous !== undefined) setStep(previous);
        }}
        onNext={() => {
          const next = NEW_BOOKING_STEPS[stepIndexOf(step) + 1];
          if (next !== undefined) setStep(next);
        }}
        canNext={canAdvanceFrom(step, form)}
        isSaving={props.state.isSaving}
      />
    </form>
  );
}

export function NewBookingSheetForm(props: NewBookingSheetFormProps): ReactElement {
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={props.labels.title} closeLabel={props.labels.close}>
        <NewBookingSheetFormInner {...props} />
      </SheetContent>
    </Sheet>
  );
}
