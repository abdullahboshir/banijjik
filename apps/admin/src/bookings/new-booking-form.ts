import type { ContactLinkValue } from "@banijjik/ui";
import type { BookingCreateBody } from "@banijjik/validation/booking";
import type { FieldErrors } from "../auth/field-errors";

export const NEW_BOOKING_STEPS = ["service", "variant", "slot", "contact", "confirm"] as const;

export type NewBookingStep = (typeof NEW_BOOKING_STEPS)[number];

export interface NewBookingFormState {
  offeringId: string;
  variantId: string;
  startsAt: string;
  resourceId: string;
  contact: ContactLinkValue | null;
  note: string;
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
      return form.startsAt !== "";
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
  const errors: FieldErrors = {};
  if (form.offeringId === "") errors.offeringId = "required";
  if (form.variantId === "") errors.variantId = "required";
  if (form.startsAt === "") errors.startsAt = "required";
  const contact = form.contact;
  if (contact === null) errors.contact = "required";
  if (Object.keys(errors).length > 0 || contact === null) return { ok: false, errors };

  const body: BookingCreateBody = {
    offeringId: form.offeringId,
    variantId: form.variantId,
    locationId,
    startsAt: form.startsAt,
    ...(form.resourceId === "" ? {} : { resourceId: form.resourceId }),
    ...(form.note.trim() === "" ? {} : { note: form.note.trim() }),
    ...(typeof contact === "string"
      ? { contactId: contact }
      : { contact: { create: contact.create } }),
  };
  return { ok: true, body };
}
