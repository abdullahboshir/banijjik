import type { AvailabilitySlot } from "@banijjik/contracts/booking";
import type { Dispatch, SetStateAction } from "react";
import type { NewBookingFormState } from "./new-booking-form";

export function newBookingFormHandlers(setForm: Dispatch<SetStateAction<NewBookingFormState>>): {
  onOfferingChange: (offeringId: string) => void;
  onVariantChange: (variantId: string) => void;
  onPickSlot: (slot: AvailabilitySlot) => void;
  onContactChange: NewBookingFormState["contact"] extends infer C ? (contact: C) => void : never;
  onNoteChange: (note: string) => void;
} {
  return {
    onOfferingChange: (offeringId) =>
      setForm((current) => ({
        ...current,
        offeringId,
        variantId: "",
        startsAt: "",
      })),
    onVariantChange: (variantId) => setForm((current) => ({ ...current, variantId, startsAt: "" })),
    onPickSlot: (slot) =>
      setForm((current) => ({
        ...current,
        startsAt: slot.startsAt,
        resourceId: slot.resourceIds[0] ?? current.resourceId,
      })),
    onContactChange: (contact) => setForm((current) => ({ ...current, contact })),
    onNoteChange: (note) => setForm((current) => ({ ...current, note })),
  };
}
