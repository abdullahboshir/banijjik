"use client";

import type {
  PublicOfferingDetailResponse,
  PublicVariantResponse,
} from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import { useEffect, useState, type ReactElement } from "react";
import {
  BookServiceButton,
  extractResources,
  ServiceScheduleOrWalkIn,
  ServiceVariantSelect,
  todayDateString,
} from "./service-booking-fields";
import { useServiceSlots } from "./use-service-slots";

export interface ServiceBookingSelectionInput {
  readonly variantId: string;
  readonly startsAt: string;
  readonly resourceIds: readonly string[];
}

export interface ServiceBookingSelectorProps {
  readonly organizationId: string;
  readonly locationId: string;
  readonly offering: PublicOfferingDetailResponse;
  readonly locale: Locale;
  readonly t: Translator["t"];
  readonly onBookService: (input: ServiceBookingSelectionInput) => void;
}

function isWalkInOnly(
  offering: PublicOfferingDetailResponse,
  variant: PublicVariantResponse | undefined,
): boolean {
  if (offering.publicCustomFields["bookingMode"] === "WALK_IN_ONLY") return true;
  if (offering.publicCustomFields["walkInOnly"] === true) return true;
  if (variant?.attributes["bookingMode"] === "WALK_IN_ONLY") return true;
  return false;
}

function canBookService(input: {
  readonly walkIn: boolean;
  readonly isAvailable: boolean | undefined;
  readonly locationId: string;
  readonly slot: string;
  readonly loading: boolean;
}): boolean {
  return (
    !input.walkIn &&
    Boolean(input.isAvailable) &&
    input.locationId !== "" &&
    input.slot !== "" &&
    !input.loading
  );
}

function useServiceBookingForm(props: ServiceBookingSelectorProps) {
  const { offering, organizationId, locationId } = props;
  const [selectedVariantId, setSelectedVariantId] = useState(offering.variants[0]?.variantId ?? "");
  const [date, setDate] = useState(() => todayDateString());
  const [slot, setSlot] = useState("");
  const [resource, setResource] = useState("");
  const selectedVariant =
    offering.variants.find((variant) => variant.variantId === selectedVariantId) ??
    offering.variants[0];
  const walkIn = isWalkInOnly(offering, selectedVariant);
  const { slots, loading } = useServiceSlots({
    organizationId,
    offeringId: offering.offeringId,
    variantId: selectedVariant?.variantId ?? "",
    locationId,
    date,
    enabled: !walkIn,
  });
  useEffect(() => {
    if (slots.some((row) => row.startsAt === slot)) return;
    setSlot(slots[0]?.startsAt ?? "");
  }, [slots, slot]);
  return {
    selectedVariantId,
    setSelectedVariantId,
    date,
    setDate,
    slot,
    setSlot,
    resource,
    setResource,
    selectedVariant,
    walkIn,
    slots,
    loading,
    canBook: canBookService({
      walkIn,
      isAvailable: selectedVariant?.isAvailable,
      locationId,
      slot,
      loading,
    }),
  };
}

export function ServiceBookingSelector(props: ServiceBookingSelectorProps): ReactElement {
  const { offering, locale, t, onBookService } = props;
  const form = useServiceBookingForm(props);
  const { walkIn, canBook, selectedVariant, slot, resource } = form;
  return (
    <div className="flex flex-col gap-5 border-t border-default pt-5">
      <ServiceVariantSelect
        variants={offering.variants}
        selectedVariantId={form.selectedVariantId}
        locale={locale}
        t={t}
        onChange={form.setSelectedVariantId}
      />
      <ServiceScheduleOrWalkIn
        walkIn={walkIn}
        date={form.date}
        slot={slot}
        slots={form.slots}
        loading={form.loading}
        resource={resource}
        resources={extractResources(offering)}
        t={t}
        onDateChange={form.setDate}
        onSlotChange={form.setSlot}
        onResourceChange={form.setResource}
      />
      <BookServiceButton
        walkIn={walkIn}
        canBook={canBook}
        t={t}
        onClick={() => {
          if (!canBook || !selectedVariant) return;
          onBookService({
            variantId: selectedVariant.variantId,
            startsAt: slot,
            resourceIds: resource ? [resource] : [],
          });
        }}
      />
    </div>
  );
}
