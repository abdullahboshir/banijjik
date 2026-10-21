import type { AvailabilitySlot } from "@banijjik/contracts/booking";
import { useEffect, useState } from "react";
import { listAvailability } from "./booking-api";
import type { NewBookingStep } from "./new-booking-form";

export function useNewBookingSlots(input: {
  step: NewBookingStep;
  organizationId: string;
  locationId: string;
  businessDate: string;
  offeringId: string;
  variantId: string;
  resourceId: string;
}): { slots: AvailabilitySlot[]; slotsLoading: boolean } {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    if (input.step !== "slot" || input.offeringId === "" || input.variantId === "") return;
    let cancelled = false;
    async function load(): Promise<void> {
      setSlotsLoading(true);
      try {
        const rows = await listAvailability(
          input.organizationId,
          new URLSearchParams({
            offeringId: input.offeringId,
            variantId: input.variantId,
            locationId: input.locationId,
            date: input.businessDate,
            ...(input.resourceId === "" ? {} : { resourceId: input.resourceId }),
          }).toString(),
        );
        if (!cancelled) setSlots(rows);
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    input.step,
    input.organizationId,
    input.locationId,
    input.businessDate,
    input.offeringId,
    input.variantId,
    input.resourceId,
  ]);

  return { slots, slotsLoading };
}
