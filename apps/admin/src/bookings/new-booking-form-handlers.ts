import type { AvailabilitySlot } from "@banijjik/contracts/booking";
import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { Dispatch, SetStateAction } from "react";
import type { EventSessionView } from "./event-session-api";
import type { NewBookingFormState } from "./new-booking-form";
import { rentalDetailsOf } from "./new-booking-mode";

function firstQuantityOf(offering: OfferingResponse | undefined): string {
  return String(rentalDetailsOf(offering)?.minUnits ?? 1);
}

export function newBookingFormHandlers(
  setForm: Dispatch<SetStateAction<NewBookingFormState>>,
  offerings: readonly OfferingResponse[],
): {
  onOfferingChange: (offeringId: string) => void;
  onVariantChange: (variantId: string) => void;
  onPickSlot: (slot: AvailabilitySlot) => void;
  onPickSession: (session: EventSessionView) => void;
  onRentalStartChange: (startsAt: string) => void;
  onResourceChange: (resourceId: string) => void;
  onContactChange: NewBookingFormState["contact"] extends infer C ? (contact: C) => void : never;
  onNoteChange: (note: string) => void;
  onQuantityChange: (quantity: string) => void;
} {
  return {
    onOfferingChange: (offeringId) =>
      setForm((current) => ({
        ...current,
        offeringId,
        variantId: "",
        startsAt: "",
        eventSessionId: "",
        resourceId: "",
        quantity: firstQuantityOf(offerings.find((offering) => offering.offeringId === offeringId)),
      })),
    onVariantChange: (variantId) =>
      setForm((current) => ({ ...current, variantId, startsAt: "", eventSessionId: "" })),
    onPickSlot: (slot) =>
      setForm((current) => ({
        ...current,
        startsAt: slot.startsAt,
        resourceId: slot.resourceIds[0] ?? current.resourceId,
      })),
    // The API needs the session start next to the session id; it copies the end from the session.
    onPickSession: (session) =>
      setForm((current) => ({
        ...current,
        eventSessionId: session.eventSessionId,
        startsAt: session.startsAt,
      })),
    onRentalStartChange: (startsAt) => setForm((current) => ({ ...current, startsAt })),
    onResourceChange: (resourceId) => setForm((current) => ({ ...current, resourceId })),
    onContactChange: (contact) => setForm((current) => ({ ...current, contact })),
    onNoteChange: (note) => setForm((current) => ({ ...current, note })),
    onQuantityChange: (quantity) => setForm((current) => ({ ...current, quantity })),
  };
}
