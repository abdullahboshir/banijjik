"use client";

import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import type { NewBookingSeed } from "./new-booking-form";
import type { NewBookingSheetProps } from "./new-booking-sheet";

export interface NewBookingFormButtonProps {
  label: string;
  organizationId: string;
  locationId: string;
  timeZone: string;
  locale: string;
  offerings: readonly OfferingResponse[];
  seed: NewBookingSeed;
  labels: import("./new-booking-sheet").NewBookingSheetLabels;
  /** Increases when the calendar taps a free slot, so the seeded sheet opens too (plan 3.6 item 9). */
  revealSignal?: number;
}

async function loadSheet(): Promise<ComponentType<NewBookingSheetProps>> {
  const sheetModule = await import("./new-booking-sheet");
  return sheetModule.NewBookingSheet;
}

export function NewBookingFormButton(props: NewBookingFormButtonProps): ReactElement {
  const { label, revealSignal, ...sheetProps } = props;
  return (
    <LazySheetButton
      label={label}
      load={loadSheet}
      sheetProps={sheetProps}
      {...(revealSignal === undefined ? {} : { revealSignal })}
    />
  );
}
