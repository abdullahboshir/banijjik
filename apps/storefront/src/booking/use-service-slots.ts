"use client";

import type { AvailabilitySlot } from "@banijjik/contracts/booking";
import { useEffect, useState } from "react";
import { fetchAvailability } from "./availability-api";

export function useServiceSlots(input: {
  readonly organizationId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly locationId: string;
  readonly date: string;
  readonly enabled: boolean;
}): { slots: readonly AvailabilitySlot[]; loading: boolean } {
  const [slots, setSlots] = useState<readonly AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!input.enabled || input.locationId === "" || input.variantId === "") {
      setSlots([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const nextSlots = await loadDaySlots(input);
      if (cancelled) return;
      setSlots(nextSlots);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    input.organizationId,
    input.offeringId,
    input.variantId,
    input.locationId,
    input.date,
    input.enabled,
  ]);
  return { slots, loading };
}

async function loadDaySlots(input: {
  readonly organizationId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly locationId: string;
  readonly date: string;
}): Promise<readonly AvailabilitySlot[]> {
  const result = await fetchAvailability(input.organizationId, {
    offeringId: input.offeringId,
    variantId: input.variantId,
    locationId: input.locationId,
    startDate: input.date,
    endDate: input.date,
  });
  const day = result.data?.days.find((row) => row.date === input.date);
  return result.ok ? (day?.slots ?? []) : [];
}
