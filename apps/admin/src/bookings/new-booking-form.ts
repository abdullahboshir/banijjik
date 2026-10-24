import type { ContactLinkValue } from "@banijjik/ui";
import type { BookingCreateBody } from "@banijjik/validation/booking";
import type { FieldErrors } from "../auth/field-errors";
import { isPositiveWholeNumber } from "./new-booking-mode";

export const NEW_BOOKING_STEPS = ["service", "variant", "slot", "contact", "confirm"] as const;

export type NewBookingStep = (typeof NEW_BOOKING_STEPS)[number];

export interface NewBookingFormState {
  offeringId: string;
  variantId: string;
  startsAt: string;
  resourceId: string;
  contact: ContactLinkValue | null;
  note: string;
  quantity: string;
  eventSessionId: string;
}

export interface NewBookingSeed {
  locationId: string;
  resourceId?: string;
  startsAt?: string;
  businessDate: string;
}

export function emptyNewBookingForm(seed: NewBookingSeed): NewBookingFormState {
  return {
    offeringId: "",
    variantId: "",
    startsAt: seed.startsAt ?? "",
    resourceId: seed.resourceId ?? "",
    contact: null,
    note: "",
    quantity: "1",
    eventSessionId: "",
  };
}

export function stepIndexOf(step: NewBookingStep): number {
  return NEW_BOOKING_STEPS.indexOf(step);
}

export function canAdvanceFrom(step: NewBookingStep, form: NewBookingFormState): boolean {
  switch (step) {
    case "service":
      return form.offeringId !== "";
    case "variant":
      return form.variantId !== "";
    case "slot":
      return (
        (form.startsAt !== "" || form.eventSessionId !== "") && isPositiveWholeNumber(form.quantity)
      );
    case "contact":
      return form.contact !== null;
    case "confirm":
      return true;
    default:
      return false;
  }
}

export function buildBookingCreate(
  form: NewBookingFormState,
  locationId: string,
): { ok: true; body: BookingCreateBody } | { ok: false; errors: FieldErrors } {
  const errors = bookingErrorsOf(form);
  const contact = form.contact;
  if (contact === null) errors.contact = "required";
  if (Object.keys(errors).length > 0 || contact === null) return { ok: false, errors };
  const quantity = Number(form.quantity);

  const body = {
    offeringId: form.offeringId,
    variantId: form.variantId,
    locationId,
    ...(form.startsAt === "" ? {} : { startsAt: form.startsAt }),
    quantity,
    ...(form.eventSessionId === "" ? {} : { eventSessionId: form.eventSessionId }),
    ...(form.resourceId === "" ? {} : { resourceId: form.resourceId }),
    ...(form.note.trim() === "" ? {} : { note: form.note.trim() }),
    ...(typeof contact === "string"
      ? { contactId: contact }
      : { contact: { create: contact.create } }),
  } as BookingCreateBody;
  return { ok: true, body };
}

function bookingErrorsOf(form: NewBookingFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (form.offeringId === "") errors.offeringId = "required";
  if (form.variantId === "") errors.variantId = "required";
  if (form.startsAt === "" && form.eventSessionId === "") errors.startsAt = "required";
  if (!isPositiveWholeNumber(form.quantity)) errors.quantity = "positive";
  return errors;
}
