"use client";

import { newId } from "@banijjik/ids";
import { useTranslator } from "@banijjik/web-client/client";
import { useMemo, useRef, useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { searchContacts } from "../contacts/contact-api";
import { keyForSubmit, type KeyedSubmit } from "../invitations/idempotency-keeper";
import { useSheetSubmit } from "../settings/use-sheet-submit";
import { createBooking } from "./booking-api";
import {
  buildBookingCreate,
  emptyNewBookingForm,
  type NewBookingFormState,
  type NewBookingStep,
} from "./new-booking-form";
import {
  bookingModeOf,
  rentalDetailsOf,
  rentalResourcesOf,
  sellableSessionsOf,
  type NewBookingModeData,
} from "./new-booking-mode";
import type { NewBookingSheetProps } from "./new-booking-sheet";
import { useNewBookingQuote, useNewBookingSessions } from "./use-new-booking-mode-data";
import { useNewBookingSlots } from "./use-new-booking-slots";

function contactLabelsOf(t: (key: string) => string) {
  return {
    search: t("form.contactLink.search"),
    noResults: t("form.contactLink.noResults"),
    createNew: t("form.contactLink.createNew"),
    name: t("form.contactLink.name"),
    phone: t("form.contactLink.phone"),
    change: t("form.contactLink.change"),
    remove: t("form.contactLink.remove"),
    linked: t("form.contactLink.linked"),
    willCreate: t("form.contactLink.willCreate"),
  };
}

function useBookingContactLink(organizationId: string, t: (key: string) => string) {
  return useMemo(
    () => ({
      search: async (text: string) => {
        const rows = await searchContacts(organizationId, text);
        return rows.map((row) => ({
          contactId: row.contactId,
          name: row.name ?? row.phoneE164 ?? "",
          phone: row.phoneE164 === undefined || row.phoneE164 === null ? undefined : row.phoneE164,
        }));
      },
      labels: contactLabelsOf(t),
    }),
    [organizationId, t],
  );
}

interface NewBookingSheetModel {
  step: NewBookingStep;
  setStep: (step: NewBookingStep) => void;
  form: NewBookingFormState;
  setForm: React.Dispatch<React.SetStateAction<NewBookingFormState>>;
  slots: ReturnType<typeof useNewBookingSlots>["slots"];
  slotsLoading: boolean;
  selectedOffering: NewBookingSheetProps["offerings"][number] | undefined;
  modeData: NewBookingModeData;
  contactLink: ReturnType<typeof useBookingContactLink>;
  contactError: string | undefined;
  state: ReturnType<typeof useSheetSubmit>;
}

function sendNewBooking(input: {
  form: NewBookingFormState;
  locationId: string;
  organizationId: string;
  lastSubmit: { current: KeyedSubmit | undefined };
}) {
  return async () => {
    const built = buildBookingCreate(input.form, input.locationId);
    if (!built.ok) return { ok: false as const, fieldErrors: built.errors };
    input.lastSubmit.current = keyForSubmit(
      input.lastSubmit.current,
      JSON.stringify(built.body),
      () => newId(),
    );
    await createBooking(input.organizationId, built.body, input.lastSubmit.current.key);
    input.lastSubmit.current = undefined;
    return { ok: true as const };
  };
}

/** Rentals and events read more than a slot list: the units, the sessions and the quoted price. */
function useNewBookingModeData(input: {
  props: NewBookingSheetProps;
  step: NewBookingStep;
  form: NewBookingFormState;
  selectedOffering: NewBookingSheetProps["offerings"][number] | undefined;
}): NewBookingModeData {
  const { props, step, form, selectedOffering } = input;
  const mode = bookingModeOf(selectedOffering);
  const rental = rentalDetailsOf(selectedOffering);
  const { sessions, sessionsLoading } = useNewBookingSessions({
    mode,
    isSlotStep: step === "slot" || step === "confirm",
    organizationId: props.organizationId,
    locationId: props.locationId,
    offeringId: form.offeringId,
  });
  const { total, quoteLoading } = useNewBookingQuote({
    isEnabled: mode !== "SLOT" && (step === "slot" || step === "confirm"),
    organizationId: props.organizationId,
    locationId: props.locationId,
    offeringId: form.offeringId,
    variantId: form.variantId,
    quantity: form.quantity,
  });
  return {
    mode,
    rental,
    rentalResources: rentalResourcesOf(props.resources, rental),
    sessions: sellableSessionsOf(sessions, { variantId: form.variantId, now: new Date() }),
    sessionsLoading,
    total,
    quoteLoading,
  };
}

export function useNewBookingSheet(props: NewBookingSheetProps): NewBookingSheetModel {
  const { t } = useTranslator();
  const [step, setStep] = useState<NewBookingStep>("service");
  const [form, setForm] = useState<NewBookingFormState>(() => emptyNewBookingForm(props.seed));
  const lastSubmit = useRef<KeyedSubmit | undefined>(undefined);
  const { slots, slotsLoading } = useNewBookingSlots({
    step,
    organizationId: props.organizationId,
    locationId: props.locationId,
    businessDate: props.seed.businessDate,
    offeringId: form.offeringId,
    variantId: form.variantId,
    resourceId: form.resourceId,
  });
  const selectedOffering = props.offerings.find(
    (offering) => offering.offeringId === form.offeringId,
  );
  const modeData = useNewBookingModeData({ props, step, form, selectedOffering });
  const contactLink = useBookingContactLink(props.organizationId, t);
  const state = useSheetSubmit({
    fieldNames: ["offeringId", "variantId", "startsAt", "contact", "note"],
    onClose: props.onClose,
    send: sendNewBooking({
      form,
      locationId: props.locationId,
      organizationId: props.organizationId,
      lastSubmit,
    }),
  });
  const contactError =
    state.errors.contact === undefined
      ? undefined
      : t(knownMessageKeyOrInternal(state.errors.contact));
  return {
    step,
    setStep,
    form,
    setForm,
    slots,
    slotsLoading,
    selectedOffering,
    modeData,
    contactLink,
    contactError,
    state,
  };
}
