import type { PublicOfferingDetailResponse } from "@banijjik/contracts/catalog";
import type { EventBookingSelectionInput } from "../booking/event-booking-selector";
import type { RentalBookingSelectionInput } from "../booking/rental-booking-selector";
import type { ServiceBookingSelectionInput } from "../booking/service-booking-selector";
import type { PlanEnrollmentSelectionInput } from "../enrollment/plan-enrollment-selector";
import type { UseOfferingSelectionResult } from "./use-offering-selection";

export interface KindControlCallbacks {
  readonly onBookService: (input: ServiceBookingSelectionInput) => void;
  readonly onBookRental: (input: RentalBookingSelectionInput) => void;
  readonly onBookEvent: (input: EventBookingSelectionInput) => void;
  readonly onEnrollPlan: (input: PlanEnrollmentSelectionInput) => void;
}

function buildServiceRentalCallbacks(
  offering: PublicOfferingDetailResponse,
  sel: UseOfferingSelectionResult,
) {
  return {
    onBookService: (input: ServiceBookingSelectionInput) => {
      const v = offering.variants.find((vr) => vr.variantId === input.variantId);
      sel.executeAdd(
        {
          kind: "SERVICE",
          offeringId: offering.offeringId,
          variantId: input.variantId,
          startsAt: input.startsAt,
          resourceIds: input.resourceIds,
        },
        {
          offeringName: offering.name,
          variantName: v?.name ?? offering.name,
          unitPrice: v?.price ?? offering.startingPrice,
          mediaUrl: offering.mediaUrl,
          kind: offering.kind,
        },
      );
    },
    onBookRental: (input: RentalBookingSelectionInput) => {
      const v = offering.variants.find((vr) => vr.variantId === input.variantId);
      sel.executeAdd(
        {
          kind: "RENTAL",
          offeringId: offering.offeringId,
          variantId: input.variantId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          resourceIds: input.resourceIds,
        },
        {
          offeringName: offering.name,
          variantName: v?.name ?? offering.name,
          unitPrice: v?.price ?? offering.startingPrice,
          mediaUrl: offering.mediaUrl,
          kind: offering.kind,
        },
      );
    },
  };
}

function buildEventPlanCallbacks(
  offering: PublicOfferingDetailResponse,
  sel: UseOfferingSelectionResult,
) {
  return {
    onBookEvent: (input: EventBookingSelectionInput) => {
      const v = offering.variants.find((vr) => vr.variantId === input.variantId);
      sel.executeAdd(
        {
          kind: "EVENT",
          offeringId: offering.offeringId,
          variantId: input.variantId,
          eventSessionId: input.eventSessionId,
          quantity: input.quantity,
        },
        {
          offeringName: offering.name,
          variantName: v?.name ?? offering.name,
          unitPrice: v?.price ?? offering.startingPrice,
          mediaUrl: offering.mediaUrl,
          kind: offering.kind,
        },
      );
    },
    onEnrollPlan: (input: PlanEnrollmentSelectionInput) => {
      const v = offering.variants.find((vr) => vr.variantId === input.variantId);
      sel.executeAdd(
        {
          kind: "PLAN",
          offeringId: offering.offeringId,
          variantId: input.variantId,
          startsOn: input.startsOn,
          resourceIds: input.resourceIds,
        },
        {
          offeringName: offering.name,
          variantName: v?.name ?? offering.name,
          unitPrice: v?.price ?? offering.startingPrice,
          mediaUrl: offering.mediaUrl,
          kind: offering.kind,
        },
        input.customFields,
      );
    },
  };
}

export function buildKindControlCallbacks(
  offering: PublicOfferingDetailResponse,
  sel: UseOfferingSelectionResult,
): KindControlCallbacks {
  return {
    ...buildServiceRentalCallbacks(offering, sel),
    ...buildEventPlanCallbacks(offering, sel),
  };
}
