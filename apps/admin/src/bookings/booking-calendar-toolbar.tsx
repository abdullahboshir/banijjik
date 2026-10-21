"use client";

import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { ReactElement } from "react";
import { NewBookingFormButton } from "./new-booking-form-button";
import type { NewBookingSeed } from "./new-booking-form";
import type { NewBookingSheetLabels } from "./new-booking-sheet";

export function BookingCalendarToolbar(props: {
  canCreate: boolean;
  addBookingLabel: string;
  organizationId: string;
  locationId: string;
  timeZone: string;
  locale: string;
  businessDate: string;
  offerings: readonly OfferingResponse[];
  seed: NewBookingSeed;
  sheetLabels: NewBookingSheetLabels;
}): ReactElement | null {
  if (!props.canCreate) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <NewBookingFormButton
        label={props.addBookingLabel}
        organizationId={props.organizationId}
        locationId={props.locationId}
        timeZone={props.timeZone}
        locale={props.locale}
        offerings={props.offerings}
        seed={props.seed}
        labels={props.sheetLabels}
      />
    </div>
  );
}
