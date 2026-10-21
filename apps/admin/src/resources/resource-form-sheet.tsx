"use client";

import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { ResourceResponse, ResourceTimeOffResponse } from "@banijjik/contracts/booking";
import { Button, Sheet, SheetContent } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useState, type FormEvent, type ReactElement } from "react";
import { SheetFeedback } from "../settings/sheet-feedback";
import { useSheetSubmit } from "../settings/use-sheet-submit";
import { type ResourceFormState } from "./resource-form";
import { initialResourceForm } from "./resource-form-initial-state";
import { ResourceFormSheetBody } from "./resource-form-sheet-body";
import { sendResourceForm } from "./resource-form-sheet-send";

export interface ResourceFormSheetProps {
  organizationId: string;
  locationId: string;
  resourceTypeKey: string;
  resourceTypes?: readonly { value: string; label: string }[];
  resourceTypeLabel?: string;
  offerings: readonly OfferingResponse[];
  existing?: ResourceResponse;
  timeOff?: readonly ResourceTimeOffResponse[];
  labels: {
    createTitle: string;
    editTitle: string;
    close: string;
    save: string;
    name: string;
    capacity: string;
    offerings: string;
    opens: string;
    closes: string;
    copyWeek: string;
    timeOff: string;
    timeOffStart: string;
    timeOffEnd: string;
    conflict: string;
    reload: string;
  };
  onClose: () => void;
}

function ResourceFormSheetInner(props: {
  form: ResourceFormState;
  setForm: React.Dispatch<React.SetStateAction<ResourceFormState>>;
  sheet: ResourceFormSheetProps;
  isEdit: boolean;
}): ReactElement {
  const { sheet } = props;
  // A client sheet reads its own translations: a server page may not pass a function through props.
  const { t } = useTranslator();
  const weekdayLabel = (weekday: number) => t(`bookings.weekday.${weekday}`);
  const state = useSheetSubmit({
    fieldNames: ["name", "capacity"],
    onClose: sheet.onClose,
    send: () =>
      sendResourceForm({
        organizationId: sheet.organizationId,
        form: props.form,
        existing: sheet.existing,
      }),
  });
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : sheet.onClose())}>
      <SheetContent
        title={props.isEdit ? sheet.labels.editTitle : sheet.labels.createTitle}
        closeLabel={sheet.labels.close}
      >
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void state.submit();
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          <ResourceFormSheetBody
            resourceTypes={sheet.resourceTypes}
            resourceTypeLabel={sheet.resourceTypeLabel}
            form={props.form}
            offerings={sheet.offerings}
            isEdit={props.isEdit}
            timeOff={sheet.timeOff}
            labels={sheet.labels}
            weekdayLabel={weekdayLabel}
            onFormChange={props.setForm}
          />
          <SheetFeedback
            state={state}
            conflict={sheet.labels.conflict}
            reload={sheet.labels.reload}
          />
          <Button type="submit" isLoading={state.isSaving}>
            {sheet.labels.save}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function ResourceFormSheet(props: ResourceFormSheetProps): ReactElement {
  const [form, setForm] = useState<ResourceFormState>(() =>
    initialResourceForm({
      locationId: props.locationId,
      resourceTypeKey: props.resourceTypeKey,
      ...(props.existing === undefined ? {} : { existing: props.existing }),
    }),
  );
  return (
    <ResourceFormSheetInner
      form={form}
      setForm={setForm}
      sheet={props}
      isEdit={props.existing !== undefined}
    />
  );
}
