"use client";

import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { ReactElement } from "react";
import type { NewBookingSeed } from "./new-booking-form";
import { NewBookingSheetForm } from "./new-booking-sheet-form";
import { useNewBookingSheet } from "./use-new-booking-sheet";

export interface NewBookingSheetLabels {
  title: string;
  close: string;
  back: string;
  next: string;
  confirm: string;
  service: string;
  variant: string;
  slot: string;
  contact: string;
  note: string;
  chooseService: string;
  chooseVariant: string;
  loadingSlots: string;
  noSlots: string;
  notSet: string;
  conflict: string;
  reload: string;
  quantity: string;
}

export interface NewBookingSheetProps {
  organizationId: string;
  locationId: string;
  timeZone: string;
  locale: string;
  offerings: readonly OfferingResponse[];
  seed: NewBookingSeed;
  labels: NewBookingSheetLabels;
  onClose: () => void;
}

export function NewBookingSheet(props: NewBookingSheetProps): ReactElement {
  const sheet = useNewBookingSheet(props);
  return (
    <NewBookingSheetForm
      labels={props.labels}
      locale={props.locale}
      timeZone={props.timeZone}
      offerings={props.offerings}
      step={sheet.step}
      setStep={sheet.setStep}
      form={sheet.form}
      setForm={sheet.setForm}
      slots={sheet.slots}
      slotsLoading={sheet.slotsLoading}
      selectedOffering={sheet.selectedOffering}
      contactLink={sheet.contactLink}
      contactError={sheet.contactError}
      state={sheet.state}
      onClose={props.onClose}
    />
  );
}
