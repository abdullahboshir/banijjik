"use client";

import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import type { Locale, Translator } from "@banijjik/i18n";
import type { ReactElement } from "react";
import {
  EventBookingSelector,
  type EventBookingSelectionInput,
} from "../booking/event-booking-selector";
import {
  RentalBookingSelector,
  type RentalBookingSelectionInput,
} from "../booking/rental-booking-selector";
import {
  ServiceBookingSelector,
  type ServiceBookingSelectionInput,
} from "../booking/service-booking-selector";
import {
  PlanEnrollmentSelector,
  type PlanEnrollmentSelectionInput,
} from "../enrollment/plan-enrollment-selector";
import { ProductVariantControls } from "./product-variant-controls";

export interface OfferingKindControlsProps {
  readonly organizationId: string;
  readonly offering: PublicOfferingDetailResponse;
  readonly locale: Locale;
  readonly t: Translator["t"];
  readonly selectedVariantId: string;
  readonly selectedModifiers: Record<string, string[]>;
  readonly quantity: number;
  readonly onVariantChange: (id: string) => void;
  readonly onModifiersChange: (mods: Record<string, string[]>) => void;
  readonly onQuantityChange: (fn: (q: number) => number) => void;
  readonly onAddToCartProduct: () => void;
  readonly onBookService: (input: ServiceBookingSelectionInput) => void;
  readonly onBookRental: (input: RentalBookingSelectionInput) => void;
  readonly onBookEvent: (input: EventBookingSelectionInput) => void;
  readonly onEnrollPlan: (input: PlanEnrollmentSelectionInput) => void;
}

export function OfferingKindControls(props: OfferingKindControlsProps): ReactElement {
  const { offering, locale, t } = props;

  if (offering.kind === "SERVICE") {
    return (
      <ServiceBookingSelector
        organizationId={props.organizationId}
        offering={offering}
        locale={locale}
        t={t}
        onBookService={props.onBookService}
      />
    );
  }

  if (offering.kind === "RENTAL") {
    return (
      <RentalBookingSelector
        offering={offering}
        locale={locale}
        t={t}
        onBookRental={props.onBookRental}
      />
    );
  }

  if (offering.kind === "EVENT") {
    return (
      <EventBookingSelector
        offering={offering}
        locale={locale}
        t={t}
        onBookEvent={props.onBookEvent}
      />
    );
  }

  if (offering.kind === "PLAN") {
    return (
      <PlanEnrollmentSelector
        offering={offering}
        locale={locale}
        t={t}
        onEnrollPlan={props.onEnrollPlan}
      />
    );
  }

  return (
    <ProductVariantControls
      offering={offering}
      locale={locale}
      t={t}
      selectedVariantId={props.selectedVariantId}
      selectedModifiers={props.selectedModifiers}
      quantity={props.quantity}
      onVariantChange={props.onVariantChange}
      onModifiersChange={props.onModifiersChange}
      onQuantityChange={props.onQuantityChange}
      onAddToCart={props.onAddToCartProduct}
    />
  );
}
