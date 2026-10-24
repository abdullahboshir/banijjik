"use client";

import { Button, Sheet, SheetContent } from "@banijjik/ui";
import type { FormEvent, ReactElement } from "react";
import { SheetFeedback } from "../settings/sheet-feedback";
import type { PlanChoice, ResourceChoice } from "./new-enrollment-form";
import type { NewEnrollmentSheetLabels } from "./new-enrollment-labels";
import {
  ContactField,
  LocationField,
  PlanFields,
  ResourceField,
  StartDateField,
} from "./new-enrollment-sheet-fields";
import { useNewEnrollmentSheet } from "./use-new-enrollment-sheet";

export interface NewEnrollmentSheetProps {
  organizationId: string;
  locationId: string;
  /** The business date today in the organization's timezone, the default start. */
  today: string;
  locations: readonly { readonly locationId: string; readonly name: string }[];
  plans: readonly PlanChoice[];
  resources: readonly ResourceChoice[];
  labels: NewEnrollmentSheetLabels;
  onClose: () => void;
}

export function NewEnrollmentSheet(props: NewEnrollmentSheetProps): ReactElement {
  const sheet = useNewEnrollmentSheet(props);
  const { form, setForm, state } = sheet;
  const { labels } = props;
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={labels.title} closeLabel={labels.close}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void state.submit();
          }}
        >
          <LocationField
            labels={labels}
            locations={props.locations}
            locationId={form.locationId}
            onChange={(locationId) => setForm({ ...form, locationId, resourceId: "" })}
          />
          <ContactField
            value={form.contact}
            error={sheet.errorOf("contact")}
            contactLink={sheet.contactLink}
            onChange={(contact) => setForm({ ...form, contact })}
          />
          <PlanFields
            labels={labels}
            plans={props.plans}
            offeringId={form.offeringId}
            variantId={form.variantId}
            selectedPlan={sheet.selectedPlan}
            onPlanChange={sheet.choosePlan}
            onVariantChange={(variantId) => setForm({ ...form, variantId })}
          />
          <StartDateField
            labels={labels}
            selectedPlan={sheet.selectedPlan}
            startsOn={form.startsOn}
            error={sheet.errorOf("startsOn")}
            onChange={(startsOn) => setForm({ ...form, startsOn })}
          />
          <ResourceField
            labels={labels}
            resources={sheet.resources}
            resourceId={form.resourceId}
            onChange={(resourceId) => setForm({ ...form, resourceId })}
          />
          <SheetFeedback state={state} conflict={labels.conflict} reload={labels.reload} />
          <Button type="submit" isLoading={state.isSaving}>
            {labels.save}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
